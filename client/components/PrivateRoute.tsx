import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { ready, token } = useAuth();

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return token ? children : <Navigate to="/login" />;
};

export default PrivateRoute;

