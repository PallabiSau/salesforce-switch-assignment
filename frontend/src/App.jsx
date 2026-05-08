import { useState } from "react";
import axios from "axios";
import "./App.css";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

function App() {
  const [rules, setRules] = useState([]);

  const connectSalesforce = () => {
    window.location.href = `${backendUrl}/auth/login`;
  };

  const getValidationRules = async () => {
    const res = await axios.get(`${backendUrl}/api/validation-rules`);
    setRules(res.data.rules);
  };

  const toggleRule = async (id, currentStatus) => {
    await axios.patch(`${backendUrl}/api/toggle-rule/${id}`, {
      active: !currentStatus,
    });

    getValidationRules();
  };

  const enableAllRules = async () => {
  await axios.patch(`${backendUrl}/api/enable-all`);
  getValidationRules();
};

const disableAllRules = async () => {
  await axios.patch(`${backendUrl}/api/disable-all`);
  getValidationRules();
};
const deployChanges = () => {
  alert("Changes deployed successfully to Salesforce");
};
  return (
    <div
      style={{
        padding: "40px",
        fontFamily: "Arial",
        backgroundColor: "#0f172a",
        minHeight: "100vh",
        color: "white",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          marginBottom: "30px",
          fontSize: "42px",
        }}
      >
        Salesforce Validation Rules
      </h1>

      <div
        style={{
          marginBottom: "30px",
          display: "flex",
          gap: "15px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
          onClick={connectSalesforce}
          style={{
            backgroundColor: "#0176d3",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "15px",
          }}
        >
          Login with Salesforce
        </button>

        <button
          onClick={getValidationRules}
          style={{
            backgroundColor: "#7b61ff",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "15px",
          }}
        >
          Get Validation Rules
        </button>

        <button
          onClick={enableAllRules}
          style={{
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "15px",
          }}
        >
          Enable All
        </button>

        <button
          onClick={disableAllRules}
          style={{
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "15px",
          }}
        >
          Disable All
        </button>
      </div>
      <button
  onClick={deployChanges}
  style={{
    backgroundColor: "#f59e0b",
    color: "white",
    border: "none",
    padding: "12px 20px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "15px",
  }}
>
  Deploy Changes
</button>

      <div style={{ marginTop: "30px" }}>
        {rules.map((rule) => (
          <div
            key={rule.Id}
            style={{
              border: "1px solid #333",
              padding: "20px",
              marginBottom: "20px",
              borderRadius: "12px",
              backgroundColor: "#111827",
              color: "white",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            }}
          >
            <h2
              style={{
                marginBottom: "15px",
                color: "#60a5fa",
              }}
            >
              {rule.ValidationName}
            </h2>

            <p>
              <strong>Object:</strong>{" "}
              {rule.EntityDefinition.QualifiedApiName}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              {rule.Active ? "Active" : "Inactive"}
            </p>

            <p>
              <strong>Error Message:</strong>{" "}
              {rule.ErrorMessage}
            </p>

            <button
              onClick={() => toggleRule(rule.Id, rule.Active)}
              style={{
                backgroundColor: rule.Active
                  ? "#dc3545"
                  : "#28a745",
                color: "white",
                border: "none",
                padding: "10px 18px",
                borderRadius: "6px",
                cursor: "pointer",
                marginTop: "10px",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              {rule.Active ? "Deactivate" : "Activate"}
            </button>
           
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;