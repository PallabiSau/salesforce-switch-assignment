import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jsforce from "jsforce";
import crypto from "crypto";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

let sfAuth = null;
let codeVerifier = null;

const getConn = () => {
  if (!sfAuth) return null;

  return new jsforce.Connection({
    instanceUrl: sfAuth.instanceUrl,
    accessToken: sfAuth.accessToken,
    oauth2: {
      loginUrl: process.env.SF_LOGIN_URL,
      clientId: process.env.SALESFORCE_CLIENT_ID,
      clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
      redirectUri: process.env.SALESFORCE_CALLBACK_URL,
    },
    refreshToken: sfAuth.refreshToken,
  });
};

app.get("/", (req, res) => {
  res.send("Salesforce Backend Running");
});

app.get("/auth/login", (req, res) => {
  codeVerifier = crypto.randomBytes(64).toString("hex");

  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const url =
    `${process.env.SF_LOGIN_URL}/services/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${process.env.SALESFORCE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.SALESFORCE_CALLBACK_URL)}` +
    `&scope=${encodeURIComponent("api refresh_token offline_access")}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  res.redirect(url);
});

app.get("/oauth/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.send("Connection Failed: Missing authorization code");
    }

    const params = new URLSearchParams();

    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("client_id", process.env.SALESFORCE_CLIENT_ID);
    params.append("client_secret", process.env.SALESFORCE_CLIENT_SECRET);
    params.append("redirect_uri", process.env.SALESFORCE_CALLBACK_URL);
    params.append("code_verifier", codeVerifier);

    const response = await fetch(
      `${process.env.SF_LOGIN_URL}/services/oauth2/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.log("OAuth Token Error:", data);
      return res.send("Connection Failed");
    }

    sfAuth = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      instanceUrl: data.instance_url,
    };

    console.log("Salesforce connected successfully");

   res.redirect(`${process.env.FRONTEND_URL}?connected=true`);
  } catch (error) {
    console.log("OAuth Error:", error);
    res.send("Connection Failed");
  }
});

app.get("/api/status", async (req, res) => {
  try {
    const conn = getConn();

    if (!conn) {
      return res.json({ connected: false });
    }

    const identity = await conn.identity();

    res.json({
      connected: true,
      user: identity.username,
    });
  } catch (error) {
    res.json({
      connected: false,
      error: error.message,
    });
  }
});

app.get("/api/validation-rules", async (req, res) => {
  try {
    const conn = getConn();

    if (!conn) {
      return res.status(401).json({
        success: false,
        message: "Salesforce not connected",
      });
    }

    const result = await conn.tooling.query(`
      SELECT Id,
             ValidationName,
             Active,
             EntityDefinition.QualifiedApiName,
             ErrorMessage
      FROM ValidationRule
      WHERE EntityDefinition.QualifiedApiName = 'Account'
    `);

    res.json({
      success: true,
      rules: result.records,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

const updateValidationRuleStatus = async (id, active) => {
  const conn = getConn();

  const result = await conn.tooling.query(`
    SELECT Id, Metadata
    FROM ValidationRule
    WHERE Id = '${id}'
  `);

  if (!result.records.length) {
    throw new Error("Validation rule not found");
  }

  const rule = result.records[0];

  await conn.tooling.sobject("ValidationRule").update({
    Id: id,
    Metadata: {
      ...rule.Metadata,
      active: active,
    },
  });
};

app.patch("/api/toggle-rule/:id", async (req, res) => {
  try {
    const conn = getConn();

    if (!conn) {
      return res.status(401).json({
        success: false,
        message: "Salesforce not connected",
      });
    }

    await updateValidationRuleStatus(req.params.id, req.body.active);

    res.json({
      success: true,
      message: "Validation rule updated",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.patch("/api/enable-all", async (req, res) => {
  try {
    const conn = getConn();

    if (!conn) {
      return res.status(401).json({
        success: false,
        message: "Salesforce not connected",
      });
    }

    const result = await conn.tooling.query(`
      SELECT Id
      FROM ValidationRule
      WHERE EntityDefinition.QualifiedApiName = 'Account'
    `);

    for (const rule of result.records) {
      await updateValidationRuleStatus(rule.Id, true);
    }

    res.json({
      success: true,
      message: "All validation rules enabled",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.patch("/api/disable-all", async (req, res) => {
  try {
    const conn = getConn();

    if (!conn) {
      return res.status(401).json({
        success: false,
        message: "Salesforce not connected",
      });
    }

    const result = await conn.tooling.query(`
      SELECT Id
      FROM ValidationRule
      WHERE EntityDefinition.QualifiedApiName = 'Account'
    `);

    for (const rule of result.records) {
      await updateValidationRuleStatus(rule.Id, false);
    }

    res.json({
      success: true,
      message: "All validation rules disabled",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(process.env.PORT || 4000, () => {
  console.log(`Server Running on ${process.env.PORT || 4000}`);
});