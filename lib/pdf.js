"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTurkishDate } from "./date";

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

function dersAraligi(students) {
  const baslangic = Math.min(...students.map((s) => s.baslangicDersi));
  const bitis = Math.max(...students.map((s) => s.bitisDersi));
  return baslangic === bitis
    ? `${baslangic}. ders`
    : `${baslangic}. ve ${bitis}. dersler arası`;
}

export async function generatePermissionPdf({ students, gun }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const usableWidth = pageWidth - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TOFAŞ FEN LİSESİ İDARESİNE", pageWidth / 2, 30, {
    align: "center",
  });

  const tarih = formatTurkishDate(gun);
  const sayi = students.length;
  const aralik = dersAraligi(students);
  const ogrenciIfade = sayi === 1 ? "öğrencisi" : "öğrencileri";

  const bodyText =
    `${tarih} tarihinde aşağıda bilgileri yer alan ${sayi} ${ogrenciIfade} ` +
    `${aralik} İnovasyon Atölyesinde bulunmaktadır. ` +
    `İzinli yazılmalarını arz ederim.`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  const wrapped = doc.splitTextToSize(bodyText, usableWidth);
  doc.text(wrapped, margin, 50);

  let cursorY = 50 + wrapped.length * 7 + 8;

  if (students.length > 1) {
    autoTable(doc, {
      startY: cursorY,
      head: [["#", "Ad Soyad", "Okul No", "Sınıf"]],
      body: students.map((s, i) => [
        i + 1,
        s.adSoyad,
        s.okulNo,
        `${s.sinif}-${s.sube}`,
      ]),
      margin: { left: margin, right: margin },
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 3,
        lineColor: [60, 60, 60],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [245, 158, 11],
        textColor: [15, 15, 16],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    cursorY = doc.lastAutoTable.finalY + 15;
  } else if (students.length === 1) {
    const s = students[0];
    doc.text(
      `Ad Soyad: ${s.adSoyad}    Okul No: ${s.okulNo}    Sınıf: ${s.sinif}-${s.sube}`,
      margin,
      cursorY
    );
    cursorY += 15;
  }

  const signature = await loadSignature();
  const sigY = Math.max(cursorY + 10, 220);
  const nameY = sigY + 30;

  if (signature) {
    try {
      doc.addImage(signature, "PNG", pageWidth - margin - 50, sigY, 45, 25);
    } catch (e) {
      console.warn("İmza eklenemedi:", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("KADİR HANÇER", pageWidth - margin, nameY, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("İnovasyon Atölyesi Sorumlusu", pageWidth - margin, nameY + 6, {
    align: "right",
  });

  doc.save(`izin-dilekcesi-${gun}.pdf`);
}
