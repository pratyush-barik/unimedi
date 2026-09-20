"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";
import { fetchCurrentSession } from "@/lib/authClient";
import { supabase } from "@/lib/supabase";

type DoctorScanned = {
  id: string;
  full_name: string;
  email: string;
  speciality?: string;
  hospital_affiliation?: string;
};

export default function PatientConnectPage() {
  const router = useRouter();

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);

  const [currentPatientId, setCurrentPatientId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [message, setMessage] = useState<{ text: string; type: "error" | "info" | "success" } | null>(null);

  // Consent Modal State
  const [scannedDoctor, setScannedDoctor] = useState<DoctorScanned | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionApproved, setSessionApproved] = useState(false);

  useEffect(() => {
    initAuthAndCamera();

    return () => {
      stopScanner();
    };
  }, []);

  const initAuthAndCamera = async () => {
    const { authenticated, user } = await fetchCurrentSession();
    if (!authenticated || !user) {
      router.replace("/patient/signin");
      return;
    }

    setCurrentPatientId(user.id);
    await loadCameras();
  };

  const loadCameras = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();

      if (devices && devices.length > 0) {
        setCameras(devices);

        // Prefer rear camera on mobile devices
        const rearIndex = devices.findIndex((cam) =>
          cam.label.toLowerCase().includes("back") ||
          cam.label.toLowerCase().includes("rear") ||
          cam.label.toLowerCase().includes("environment")
        );

        const targetIndex = rearIndex >= 0 ? rearIndex : 0;
        setCameraIndex(targetIndex);
        startScanner(devices[targetIndex].id);
      } else {
        setMessage({ text: "No camera found on your device.", type: "error" });
      }
    } catch {
      setMessage({ text: "Camera permission denied. Please allow camera access.", type: "error" });
    }
  };

  const startScanner = async (cameraId: string) => {
    try {
      await stopScanner();

      const qr = new Html5Qrcode("reader");
      scannerRef.current = qr;

      await qr.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          if (scanningRef.current) return;
          scanningRef.current = true;
          await handleQrDecoded(decodedText);
        },
        () => {}
      );

      setCameraStarted(true);
      setMessage(null);
    } catch (err: any) {
      console.error("Camera start error:", err);
      setMessage({ text: "Unable to start camera scanner.", type: "error" });
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch {}
    setCameraStarted(false);
  };

  const flipCamera = async () => {
    if (cameras.length < 2) {
      setMessage({ text: "Only one camera available on device.", type: "info" });
      return;
    }

    const nextIndex = (cameraIndex + 1) % cameras.length;
    setCameraIndex(nextIndex);
    await startScanner(cameras[nextIndex].id);
  };

  const handleQrDecoded = async (decodedText: string) => {
    setLoading(true);
    setMessage(null);

    try {
      let doctorEmailOrId = decodedText.trim();
      let doctorObj: DoctorScanned | null = null;

      // Try parsing JSON if encoded as structured object
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed.doctorId || parsed.email) {
          doctorEmailOrId = parsed.doctorId || parsed.email;
        }
      } catch {}

      // Look up doctor in users
      let query = supabase.from("users").select("id, full_name, email");
      if (doctorEmailOrId.includes("@")) {
        query = query.eq("email", doctorEmailOrId.toLowerCase());
      } else {
        query = query.eq("id", doctorEmailOrId);
      }

      const { data: docUser, error: docErr } = await query.maybeSingle();

      if (docErr || !docUser) {
        setMessage({ text: "Doctor not recognized. Please scan a valid UniMedi doctor QR.", type: "error" });
        scanningRef.current = false;
        setLoading(false);
        return;
      }

      // Check role
      const { data: docRole } = await supabase
        .from("user_roles")
        .select("speciality, hospital_affiliation")
        .eq("user_id", docUser.id)
        .eq("role", "doctor")
        .maybeSingle();

      doctorObj = {
        id: docUser.id,
        full_name: docUser.full_name || "Doctor",
        email: docUser.email,
        speciality: docRole?.speciality || "General Physician",
        hospital_affiliation: docRole?.hospital_affiliation || "UniMedi Clinic",
      };

      setScannedDoctor(doctorObj);

      // Create session with approved = FALSE (Requiring explicit user confirmation)
      const { data: createdSession, error: sessionErr } = await supabase
        .from("doctor_sessions")
        .insert([
          {
            patient_id: currentPatientId,
            doctor_id: doctorObj.id,
            approved: false, // Security constraint: Never auto-approve
          },
        ])
        .select()
        .single();

      if (sessionErr) throw sessionErr;

      setSessionId(createdSession.id);
      await stopScanner();
    } catch (err: any) {
      console.error("QR connect error:", err);
      setMessage({ text: err.message || "Failed to initiate doctor connection.", type: "error" });
      scanningRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const approveAccess = async () => {
    if (!sessionId) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("doctor_sessions")
        .update({ approved: true })
        .eq("id", sessionId);

      if (error) throw error;

      setSessionApproved(true);
      setMessage({
        text: "Consultation Access Approved! Your doctor can now review your health history and issue prescriptions.",
        type: "success",
      });
    } catch (err: any) {
      setMessage({ text: "Failed to approve session.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const denyAccess = async () => {
    if (sessionId) {
      await supabase.from("doctor_sessions").delete().eq("id", sessionId);
    }
    setScannedDoctor(null);
    setSessionId(null);
    setSessionApproved(false);
    scanningRef.current = false;
    await loadCameras();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-100/60 p-6 md:p-8 flex flex-col justify-between">
      <div className="max-w-xl w-full mx-auto my-auto">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-black text-xl flex items-center justify-center mx-auto mb-3 shadow-xs">
              📲
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Scan Doctor QR Code
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Point your camera at the doctor's clinic QR code to connect
            </p>
          </div>

          {/* Alerts */}
          {message && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold mb-6 border ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : message.type === "info"
                  ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Consent Modal Prompt */}
          {scannedDoctor && !sessionApproved && (
            <div className="bg-indigo-50/80 border-2 border-indigo-200 rounded-2xl p-6 mb-6 text-center space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-black text-xl flex items-center justify-center mx-auto">
                👨‍⚕️
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Dr. {scannedDoctor.full_name}
                </h3>
                <p className="text-xs font-semibold text-indigo-700">
                  {scannedDoctor.speciality} • {scannedDoctor.hospital_affiliation}
                </p>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {scannedDoctor.email}
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl text-xs text-slate-600 text-left border border-indigo-100">
                <span className="font-bold text-slate-900 block mb-1">
                  🔒 Explicit Patient Consent Request
                </span>
                By tapping Approve, you grant temporary access for Dr. {scannedDoctor.full_name} to view your medical history and record clinical prescriptions.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={approveAccess}
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl shadow-xs transition text-sm"
                >
                  {loading ? "Approving..." : "✓ Approve Access"}
                </button>
                <button
                  onClick={denyAccess}
                  disabled={loading}
                  className="px-5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold py-3 rounded-xl transition text-sm"
                >
                  Deny
                </button>
              </div>
            </div>
          )}

          {/* Success State */}
          {sessionApproved && scannedDoctor && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4 mb-6 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white text-2xl flex items-center justify-center mx-auto">
                ✓
              </div>
              <h3 className="text-lg font-bold text-emerald-950">
                Connected with Dr. {scannedDoctor.full_name}
              </h3>
              <p className="text-xs text-emerald-800">
                Your consultation session is active. Please proceed with your doctor.
              </p>
              <Link
                href="/patient/dashboard"
                className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-xs"
              >
                Return to Dashboard
              </Link>
            </div>
          )}

          {/* Camera Scanner Viewport */}
          {!scannedDoctor && (
            <div className="space-y-4">
              <div
                id="reader"
                className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900"
              />

              <div className="flex gap-3">
                <button
                  onClick={flipCamera}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-sm transition"
                >
                  Flip Camera
                </button>
                <Link
                  href="/patient/dashboard"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-sm transition text-center"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}