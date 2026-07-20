import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Logs an audit action to Firestore.
 */
export async function logAuditAction(
  adminId: string,
  adminName: string,
  action: string,
  targetUser: string = "System",
  description: string = ""
) {
  try {
    await addDoc(collection(db, "auditLogs"), {
      adminId,
      adminName,
      action,
      targetUser,
      description,
      date: new Date().toLocaleDateString("en-IN"),
      time: new Date().toLocaleTimeString("en-IN"),
      ip: "127.0.0.1", // Fallback for clients
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
