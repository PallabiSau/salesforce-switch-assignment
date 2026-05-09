import axios from "axios";
import "./App.css";
import { useState, useEffect } from "react";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

function App() {
  const [rules, setRules] = useState([]);
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);

  const connectSalesforce = () => {
    window.location.href = `${backendUrl}/auth/login`;
  };

  const getValidationRules = async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/validation-rules`);
      setRules(res.data.rules || []);
      setMessage("Validation rules loaded successfully");
    } catch (error) {
      setMessage("Please login with Salesforce first");
    }
  };

  const toggleRule = async (id, currentStatus) => {
    await axios.patch(`${backendUrl}/api/toggle-rule/${id}`, {
      active: !currentStatus,
    });
    await getValidationRules();
  };

  const enableAllRules = async () => {
    await axios.patch(`${backendUrl}/api/enable-all`);
    await getValidationRules();
  };

  const disableAllRules = async () => {
    await axios.patch(`${backendUrl}/api/disable-all`);
    await getValidationRules();
  };

  
useEffect(() => {
  const checkConnection = async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/status`);

      if (res.data.connected) {
        setConnected(true);
        setMessage("Connected Successfully to Salesforce");
      }
    } catch (err) {
      console.log(err);
    }
  };

  checkConnection();
}, []);


  const deployChanges = () => {
    setMessage("Changes deployed successfully to Salesforce");
  };

  return (
    <div className="page">
      <h1>Salesforce Validation Rules</h1>

      {connected && (
  <div
    style={{
      backgroundColor: "#16a34a",
      color: "white",
      padding: "12px",
      borderRadius: "8px",
      marginBottom: "20px",
      textAlign: "center",
      fontWeight: "bold",
    }}
  >
    Connected Successfully to Salesforce
  </div>
)}

      <div className="buttonGroup">
        <button className="btn blue" onClick={connectSalesforce}>
          Login with Salesforce
        </button>

        <button className="btn purple" onClick={getValidationRules}>
          Get Validation Rules
        </button>

        <button className="btn green" onClick={enableAllRules}>
          Enable All
        </button>

        <button className="btn red" onClick={disableAllRules}>
          Disable All
        </button>

        <button className="btn orange" onClick={deployChanges}>
          Deploy Changes
        </button>
      </div>

      {message && <p className="message">{message}</p>}

      <div className="rules">
        {rules.map((rule) => (
          <div className="card" key={rule.Id}>
            <h2>{rule.ValidationName}</h2>

            <p>
              <strong>Object:</strong>{" "}
              {rule.EntityDefinition?.QualifiedApiName}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              <span className={rule.Active ? "active" : "inactive"}>
                {rule.Active ? "Active" : "Inactive"}
              </span>
            </p>

            <p>
              <strong>Error Message:</strong> {rule.ErrorMessage}
            </p>

            <button
              className={rule.Active ? "btn red small" : "btn green small"}
              onClick={() => toggleRule(rule.Id, rule.Active)}
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