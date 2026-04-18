"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Html5Qrcode } from "html5-qrcode";

export default function ScannerPage() {

  const router = useRouter();

  useEffect(() => {

    let scanner: Html5Qrcode | null = null;
    let scanning = false;

    const startScanner = async () => {

      const { Html5Qrcode } = await import("html5-qrcode");

      scanner = new Html5Qrcode("reader");

      try {

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          async (decodedText: string) => {

            if (!scanning) return;

            console.log("QR detected:", decodedText);

            let doctorData;

            try {
              doctorData = JSON.parse(decodedText);
            } catch {
              alert("Invalid QR code.");
              return;
            }

            const now = Date.now();
            const expiryTime = 2 * 60 * 1000; // 2 minutes

            if (now - doctorData.timestamp > expiryTime) {
              alert("QR code expired. Ask doctor to generate a new one.");
              return;
            }

            scanning = false;

            localStorage.setItem(
              "accessRequest",
              JSON.stringify(doctorData)
            );

            if (scanner) {
              await scanner.stop();
            }

            router.push("/patient/dashboard");

          },
          () => {}
        );

        scanning = true;

      } catch (err) {
        console.error("Scanner error:", err);
      }

    };

    startScanner();

    return () => {
      if (scanner && scanning) {
        scanner.stop().catch(() => {});
      }
    };

  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">

      <h1 className="text-3xl font-bold mb-6">QR Scanner</h1>

      <div
        id="reader"
        className="bg-white p-4 rounded shadow"
        style={{ width: "320px" }}
      />

    </div>
  );
}