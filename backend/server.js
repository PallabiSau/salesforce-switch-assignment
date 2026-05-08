import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jsforce from "jsforce";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

const oauth2 = new jsforce.OAuth2({
  loginUrl: "https://login.salesforce.com",
  clientId: process.env.SALESFORCE_CLIENT_ID,
  clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
  redirectUri: process.env.SALESFORCE_CALLBACK_URL,
});

let conn;
let sfAuth = null;

app.get("/", (req, res) => {
  res.send("Salesforce Backend Running");
});

app.get("/auth/login", (req, res) => {
  const authUrl = oauth2.getAuthorizationUrl({
    scope: "api refresh_token full",
  });

  res.redirect(authUrl);
});

app.get("/oauth/callback", async (req, res) => {
  try {
    const { code } = req.query;

    conn = new jsforce.Connection({ oauth2 });

    await conn.authorize(code);

    sfAuth = {
      accessToken: conn.accessToken,
      instanceUrl: conn.instanceUrl,
    };

    res.send("Salesforce Connected Successfully");
  } catch (error) {
    console.log(error);
    res.send("Connection Failed");
  }
});

const getSalesforceConnection = () => {
  if (!sfAuth) return null;

  return new jsforce.Connection({
    instanceUrl: sfAuth.instanceUrl,
    accessToken: sfAuth.accessToken,
  });
};

app.get("/api/status", async (req, res) => {
  try {
    conn = getSalesforceConnection();

    if (!conn) {
      return res.json({ connected: false });
    }

    const identity = await conn.identity();

    res.json({
      connected: true,
      user: identity,
    });
  } catch (error) {
    res.json({ connected: false });
  }
});

app.get("/api/validation-rules", async (req, res) => {
  try {
    conn = getSalesforceConnection();

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
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch validation rules",
      error: error.message,
    });
  }
});

const updateValidationRuleStatus = async (id, active) => {
  conn = getSalesforceConnection();

  const result = await conn.tooling.query(`
    SELECT Id, ValidationName, Active, ErrorMessage, ValidationFormula
    FROM ValidationRule
    WHERE Id = '${id}'
  `);

  const rule = result.records[0];

  await conn.tooling.sobject("ValidationRule").update({
    Id: id,
    Metadata: {
      active: active,
      validationName: rule.ValidationName,
      errorMessage: rule.ErrorMessage,
      validationFormula: rule.ValidationFormula,
    },
  });
};

app.patch("/api/toggle-rule/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    conn = getSalesforceConnection();

    if (!conn) {
      return res.status(401).json({
        success: false,
        message: "Salesforce not connected",
      });
    }

    await updateValidationRuleStatus(id, active);

    res.json({
      success: true,
      message: "Validation rule updated",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Failed to update validation rule",
      error: error.message,
    });
  }
});

app.patch("/api/enable-all", async (req, res) => {
  try {
    conn = getSalesforceConnection();

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
      message: "Failed to enable all rules",
      error: error.message,
    });
  }
});

app.patch("/api/disable-all", async (req, res) => {
  try {
    conn = getSalesforceConnection();

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
      message: "Failed to disable all rules",
      error: error.message,
    });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server Running on ${process.env.PORT}`);
});