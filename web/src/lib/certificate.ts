// Generates a course-completion certificate as a downloadable PNG using <canvas>.
export function downloadCertificate(studentName: string, courseTitle: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1100;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 1600, 1100);
  bg.addColorStop(0, "#f8fafc");
  bg.addColorStop(1, "#eef6f7");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1600, 1100);

  // Outer border
  ctx.strokeStyle = "#0f4a52";
  ctx.lineWidth = 8;
  ctx.strokeRect(40, 40, 1520, 1020);

  // Inner gold border
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth = 2;
  ctx.strokeRect(70, 70, 1460, 960);

  // Header band
  const band = ctx.createLinearGradient(0, 100, 1600, 100);
  band.addColorStop(0, "#0f4a52");
  band.addColorStop(1, "#1d6c75");
  ctx.fillStyle = band;
  ctx.fillRect(100, 100, 1400, 90);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("DR. SALAH ALZAIT MEDICAL ACADEMY", 800, 158);

  // Title
  ctx.fillStyle = "#0f4a52";
  ctx.font = "italic 56px Georgia, serif";
  ctx.fillText("Certificate of Completion", 800, 320);

  // Decorative gold line
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(600, 360);
  ctx.lineTo(1000, 360);
  ctx.stroke();

  // Subtitle
  ctx.fillStyle = "#475569";
  ctx.font = "26px Georgia, serif";
  ctx.fillText("This is proudly presented to", 800, 440);

  // Student name
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 76px Georgia, serif";
  ctx.fillText(studentName, 800, 540);

  // underline name
  ctx.strokeStyle = "#0f4a52";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(400, 570);
  ctx.lineTo(1200, 570);
  ctx.stroke();

  // Body
  ctx.fillStyle = "#334155";
  ctx.font = "24px Georgia, serif";
  ctx.fillText("for successfully completing the course", 800, 630);

  ctx.fillStyle = "#0f4a52";
  ctx.font = "bold 42px Georgia, serif";
  ctx.fillText(`“${courseTitle}”`, 800, 700);

  ctx.fillStyle = "#475569";
  ctx.font = "20px Georgia, serif";
  ctx.fillText("with dedication, integrity, and excellence in clinical practice.", 800, 750);

  // Footer signatures
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(260, 920); ctx.lineTo(560, 920);
  ctx.moveTo(1040, 920); ctx.lineTo(1340, 920);
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 22px Georgia, serif";
  ctx.fillText("Dr. Salah Alzait", 410, 955);
  ctx.font = "16px Georgia, serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Founder & Lead Instructor", 410, 980);

  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 22px Georgia, serif";
  ctx.fillText(date, 1190, 955);
  ctx.font = "16px Georgia, serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Date of Issue", 1190, 980);

  // Seal
  ctx.beginPath();
  ctx.arc(800, 920, 60, 0, Math.PI * 2);
  ctx.fillStyle = "#d4a017";
  ctx.fill();
  ctx.fillStyle = "#0f4a52";
  ctx.font = "bold 14px Georgia, serif";
  ctx.fillText("VERIFIED", 800, 915);
  ctx.font = "bold 11px Georgia, serif";
  ctx.fillText("ACADEMY SEAL", 800, 935);

  const link = document.createElement("a");
  link.download = `Certificate-${courseTitle.replace(/\s+/g, "_")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
