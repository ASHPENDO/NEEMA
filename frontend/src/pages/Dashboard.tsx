import React from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom"; // ✅ added

export default function Dashboard() {
  const { me, logout } = useAuth();
  const nav = useNavigate(); // ✅ added

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold tracking-wide text-slate-500">POSTIKA</div>
              <h1 className="text-2xl font-semibold text-slate-900 mt-1">Dashboard</h1>
              <p className="text-sm text-slate-600 mt-2">
                Protected route placeholder. Replace this with your real dashboard layout.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => nav("/tenant-invitations")}>
                Invitations
              </Button>

              <Button variant="secondary" onClick={logout}>
                Log out
              </Button>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-900">Current user</div>
            <pre className="text-xs text-slate-700 mt-2 overflow-auto">
{JSON.stringify(me, null, 2)}
            </pre>
          </div>
        </motion.div>
      </div>
    </div>
  );
}