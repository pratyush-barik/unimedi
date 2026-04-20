"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/lib/supabase";

export default function PatientConnectPage() {
  const router = useRouter();

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [cameraStarted, setCameraStarted] = useState(false);

  // 🔥 new states
  const [cameras, setCameras] = useState<any[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);

  useEffect(() => {
    loadCameras();

    return () => {
      stopScanner();
    };
  }, []);

  const loadCameras = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();

      if (devices && devices.length > 0) {
        setCameras(devices);

        // Prefer rear camera if found
        const rearIndex = devices.findIndex((cam) =>
          cam.label.toLowerCase().includes("back") ||
          cam.label.toLowerCase().includes("rear") ||
          cam.label.toLowerCase().includes("environment")
        );

        if (rearIndex >= 0) {
          setCameraIndex(rearIndex);
          startScanner(devices[rearIndex].id);
        } else {
          startScanner(devices[0].id);
        }
      } else {
        setMessage("No camera found");
      }
    } catch {
      setMessage("Camera permission denied");
    }
  };

  const startScanner = async (cameraId: string) => {
    try {
      stopScanner();

      const qr = new Html5Qrcode("reader");
      scannerRef.current = qr;

      await qr.start(
        cameraId,
        {
          fps: 10,
          qrbox: 250,
        },
        async (decodedText) => {
          if (scanningRef.current) return;

          scanningRef.current = true;
          await connectDoctor(decodedText);
        },
        () => {}
      );

      setCameraStarted(true);
      setMessage("");
    } catch {
      setMessage("Unable to start camera");
    }
  };

  const stopScanner = async () => {
    try {
      if (
        scannerRef.current &&
        scannerRef.current.isScanning
      ) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch {}

    setCameraStarted(false);
  };

  const flipCamera = async () => {
    if (cameras.length < 2) {
      setMessage("Only one camera available");
      return;
    }

    const nextIndex =
      (cameraIndex + 1) % cameras.length;

    setCameraIndex(nextIndex);

    await startScanner(cameras[nextIndex].id);
  };

  const connectDoctor = async (doctorEmail: string) => {
    try {
      setLoading(true);

      const stored = localStorage.getItem("session");

      if (!stored) {
        router.push("/patient/signin");
        return;
      }

      const session = JSON.parse(stored);

      const { data: patient } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.email)
        .maybeSingle();

      const { data: doctor } = await supabase
        .from("users")
        .select("id")
        .eq("email", doctorEmail)
        .maybeSingle();

      if (!patient || !doctor) {
        setMessage("Doctor not found");
        scanningRef.current = false;
        return;
      }

      await supabase
        .from("doctor_sessions")
        .insert([
          {
            patient_id: patient.id,
            doctor_id: doctor.id,
            approved: true,
          },
        ]);

      await stopScanner();

      alert("Doctor connected successfully");

      router.push("/patient/dashboard");

    } catch {
      setMessage("Connection failed");
      scanningRef.current = false;
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-6">

      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl p-8">

        <h1 className="text-3xl font-bold text-indigo-600 mb-2 text-center">
          Connect to Doctor
        </h1>

        <p className="text-center text-gray-500 mb-6">
          Scan doctor QR to connect
        </p>

        <div
          id="reader"
          className="w-full overflow-hidden rounded-xl border"
        />

        <div className="mt-5 flex gap-3">

          <button
            onClick={flipCamera}
            className="flex-1 bg-indigo-600 text-white py-3 rounded-lg"
          >
            Flip Camera
          </button>

          <button
            onClick={() =>
              router.push("/patient/dashboard")
            }
            className="flex-1 bg-gray-200 py-3 rounded-lg"
          >
            Back
          </button>

        </div>

        {loading && (
          <p className="text-center mt-4 text-gray-500">
            Connecting...
          </p>
        )}

        {message && (
          <p className="text-center mt-4 text-sm text-red-500">
            {message}
          </p>
        )}

      </div>

    </div>
  );
}