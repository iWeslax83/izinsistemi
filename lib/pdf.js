"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTurkishDate } from "./date";

async function fetchAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font yüklenemedi: ${url}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const base64 = typeof result === "string" ? result.split(",")[1] : "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function registerTurkishFont(doc) {
  try {
    const [regular, bold] = await Promise.all([
      fetchAsBase64("/fonts/NotoSans-Regular.ttf"),
      fetchAsBase64("/fonts/NotoSans-Bold.ttf"),
    ]);
    doc.addFileToVFS("NotoSans-Regular.ttf", regular);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.addFileToVFS("NotoSans-Bold.ttf", bold);
    doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
    return true;
  } catch (e) {
    console.warn("Türkçe font yüklenemedi, helvetica'ya düşülüyor:", e);
    return false;
  }
}

async function loadSignature() {
  try {
    const res = await fetch("/signature.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function dersAraligi(s) {
  return s.baslangicDersi === s.bitisDersi
    ? `${s.baslangicDersi}. ders`
    : `${s.baslangicDersi}. - ${s.bitisDersi}. dersler`;
}

export async function generatePermissionPdf({ students, gun }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const usableWidth = pageWidth - margin * 2;

  const hasTrFont = await registerTurkishFont(doc);
  const fontName = hasTrFont ? "NotoSans" : "helvetica";

  doc.setFont(fontName, "normal");
  doc.setFontSize(11);
  doc.text(`Tarih: ${formatTurkishDate(gun)}`, pageWidth - margin, 20, {
    align: "right",
  });

  doc.setFont(fontName, "bold");
  doc.setFontSize(14);
  doc.text("TOFAŞ FEN LİSESİ İDARESİNE", pageWidth / 2, 40, {
    align: "center",
  });

  const bodyText =
    "Aşağıda isimleri yer alan öğrencilerin, karşılarında belirtilen nedenler doğrultusunda belirtilen derslerden izinli sayılmalarını arz ederim.";

  doc.setFont(fontName, "normal");
  doc.setFontSize(12);
  const lineHeight = 6;
  const wrapped = doc.splitTextToSize(bodyText, usableWidth);
  doc.text(wrapped, margin, 55, { align: "justify", maxWidth: usableWidth });

  let cursorY = 55 + wrapped.length * lineHeight + 8;

  autoTable(doc, {
    startY: cursorY,
    head: [["#", "Ad Soyad", "Okul No", "Sınıf", "İzinli Dersler", "Neden"]],
    body: students.map((s, i) => [
      i + 1,
      s.adSoyad,
      s.okulNo,
      `${s.sinif}-${s.sube}`,
      dersAraligi(s),
      s.neden || "",
    ]),
    margin: { left: margin, right: margin },
    tableWidth: usableWidth,
    theme: "grid",
    styles: {
      font: fontName,
      fontSize: 10,
      cellPadding: 2.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      font: fontName,
      fontStyle: "bold",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 34 },
      2: { cellWidth: 18 },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 28 },
      5: { cellWidth: usableWidth - 102 },
    },
  });
  cursorY = doc.lastAutoTable.finalY + 20;

  const signature = await loadSignature();
  const sigAreaRight = pageWidth - margin;
  const sigBlockWidth = 60;
  const sigBlockLeft = sigAreaRight - sigBlockWidth;

  const sigTopY = Math.max(cursorY + 10, 220);
  const sigHeight = 24;
  const sigLineY = sigTopY + sigHeight + 2;

  if (signature) {
    try {
      doc.addImage(
        signature,
        "PNG",
        sigAreaRight - 45,
        sigTopY,
        40,
        sigHeight
      );
    } catch (e) {
      console.warn("İmza eklenemedi:", e);
    }
  }

  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);
  doc.line(sigBlockLeft, sigLineY, sigAreaRight, sigLineY);

  doc.setFont(fontName, "bold");
  doc.setFontSize(12);
  doc.text("Kadir HANÇER", sigAreaRight, sigLineY + 6, { align: "right" });
  doc.setFont(fontName, "normal");
  doc.setFontSize(10);
  doc.text("Bilişim Teknolojileri Öğretmeni", sigAreaRight, sigLineY + 11, {
    align: "right",
  });

  doc.save(`izin-dilekcesi-${gun}.pdf`);
}
