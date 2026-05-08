import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jsforce from "jsforce";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const oauth2 = new jsforce.OAuth2({
  loginUrl: "https://login.salesforce.com",
  clientId: process.env.SALESFORCE_CLIENT_ID,
  clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
  redirectUri: process.env.SALESFORCE_CALLBACK_URL,
});

let sfAuth = null;

const getConn = () => {
  if (!sfAuth) return null;

  return new jsforce.Connection({
    oauth2,
    instanceUrl: sfAuth.instanceUrl,
    accessToken: sfAuth.accessToken,
    refreshToken: sfAuth.refreshToken,
  });
};

app.get("/", (req, res) => {
  res.send("Salesforce Backend Running");
});

app.get("/auth/login", (req, res) => {
  const url = oauth2.getAuthorizationUrl({
    scope: "api full refresh_token offline_access",
  });

  res.redirect(url);
});

app.get("/oauth/callback", async (req, res) => {
  try {
    const conn = new jsforce.Connection({ oauth2 });
    await conn.authorize(req.query.code);

    sfAuth = {
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken,
      instanceUrl: conn.instanceUrl,
    };

    console.log("Salesforce connected");

    res.redirect("https://salesforce-switch-assignment.vercel.app");
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
    res.json({ connected: false, error: error.message });
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
      SELECT Id, ValidationName, Active, EntityDefinition.QualifiedApiName, ErrorMessage
      FROM ValidationRule
      WHERE EntityDefinition.QualifiedApiName = 'Account'
    `);

    res.json({
      success: true,
      rules: result.records,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

const updateValidationRuleStatus = async (id, active) => {
  const conn = getConn();

  const result = await conn.tooling.query(`
    SELECT Id, ValidationName, ErrorMessage, ValidationFormula
    FROM ValidationRule
    WHERE Id = '${id}'
  `);

  const rule = result.records[0];

  await conn.tooling.sobject("ValidationRule").update({
    Id: id,
    Metadata: {
      active,
      validationName: rule.ValidationName,
      errorMessage: rule.ErrorMessage,
      validationFormula: rule.ValidationFormula,
    },
  });
};

app.patch("/api/toggle-rule/:id", async (req, res) => {
  try {
    if (!getConn()) {
      return res.status(401).json({ success: false, message: "Salesforce not connected" });
    }

    await updateValidationRuleStatus(req.params.id, req.body.active);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch("/api/enable-all", async (req, res) => {
  try {
    const conn = getConn();

    if (!conn) {
      return res.status(401).json({ success: false, message: "Salesforce not connected" });
    }

    const result = await conn.tooling.query(`
      SELECT Id
      FROM ValidationRule
      WHERE EntityDefinition.QualifiedApiName = 'Account'
    `);

    for (const rule of result.records) {
      await updateValidationRuleStatus(rule.Id, true);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch("/api/disable-all", async (req, res) => {
  try {
    const conn = getConn();

    if (!conn) {
      return res.status(401).json({ success: false, message: "Salesforce not connected" });
    }

    const result = await conn.tooling.query(`
      SELECT Id
      FROM ValidationRule
      WHERE EntityDefinition.QualifiedApiName = 'Account'
    `);

    for (const rule of result.records) {
      await updateValidationRuleStatus(rule.Id, false);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(process.env.PORT || 4000, () => {
  console.log(`Server Running on ${process.env.PORT || 4000}`);
});