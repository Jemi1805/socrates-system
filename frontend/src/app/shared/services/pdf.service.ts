import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
// import autoTable from 'jspdf-autotable'; // Descomentar si se requieren tablas más adelante

export interface Fmdg1Data {
  codCeta?: string;
  nombreCompleto?: string;
  nombres?: string;
  apellidos?: string;
  ci?: string;
  expedicion?: string;
  celular?: string;
  instituto?: string;
  carrera?: string;
  modalidad?: string;
  tema?: string;
  objetivo?: string;
}

@Injectable({ providedIn: 'root' })
export class PdfService {
  private verdanaReady = false;

  private async arrayBufferToBase64(buf: ArrayBuffer): Promise<string> {
    let binary = '';
    const bytes = new Uint8Array(buf);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  private async ensureVerdana(doc: jsPDF) {
    if (this.verdanaReady) return;
    try {
      const normalRes = await fetch('assets/fonts/verdana.ttf');
      const boldRes = await fetch('assets/fonts/verdana-bold.ttf');
      const normalBuf = await normalRes.arrayBuffer();
      const boldBuf = await boldRes.arrayBuffer();
      const normalB64 = await this.arrayBufferToBase64(normalBuf);
      const boldB64 = await this.arrayBufferToBase64(boldBuf);
      (doc as any).addFileToVFS('verdana-normal.ttf', normalB64);
      (doc as any).addFileToVFS('verdana-bold.ttf', boldB64);
      (doc as any).addFont('verdana-normal.ttf', 'verdana', 'normal');
      (doc as any).addFont('verdana-bold.ttf', 'verdana', 'bold');
      this.verdanaReady = true;
    } catch {
      // Si no existen las fuentes, jsPDF usará helvetica como fallback
    }
  }
  private async loadImageDataUrl(url: string): Promise<string> {
    // Carga imagen y la convierte a DataURL para jsPDF
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  async generarFMDG1(data: Fmdg1Data, options?: { logoUrl?: string }) {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' }); // 216 x 279 mm aprox
    // Usaremos la fuente por defecto (Helvetica)

    const margin = 15;
    let y = margin;

    // Encabezado con logo
    const logoUrl = options?.logoUrl || 'assets/images/LOGO-CETA.png';
    try {
      const dataUrl = await this.loadImageDataUrl(logoUrl);
      const logoW = 22; // ancho en mm
      const logoH = 22; // alto en mm
      doc.addImage(dataUrl, 'PNG', margin, y - 2, logoW, logoH, undefined, 'FAST');
    } catch {
      // Si falla la carga del logo, continuamos sin interrumpir
    }

    // Helper para subrayado centrado
    const underlineCentered = (text: string, yPos: number, offset = 1.5) => {
      const w = doc.getTextWidth(text);
      const x1 = 108.5 - w / 2;
      const x2 = 108.5 + w / 2;
      doc.line(x1, yPos + offset, x2, yPos + offset);
    };

    // Títulos centrados según ejemplo (con subrayado)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const instText = 'INSTITUTO TECNOLÓGICO DE ENSEÑANZA AUTOMOTRIZ';
    doc.text(instText, 108.5, y, { align: 'center' });
    underlineCentered(instText, y);
    y += 8; // más espacio después del instituto
    doc.setFontSize(16);
    const cetaText = '"CETA"';
    doc.text(cetaText, 108.5, y, { align: 'center' });
    underlineCentered(cetaText, y);
    y += 10; // más espacio después de "CETA"
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Cochabamba – Bolivia', 108.5, y, { align: 'center' });
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Resolución Ministerial N° 0595/2019', 108.5, y, { align: 'center' });
    y += 4;
    // Línea separadora
    doc.setLineWidth(0.8);
    doc.line(margin, y, 216 - margin, y);
    y += 8;

    // Título del formulario
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('FORMULARIO DE MODALIDAD DE GRADUACIÓN (FMDG-1)', 108.5, y, { align: 'center' });
    y += 6;

    // Cuadro principal con etiquetas azules usando autoTable
    const tableMarginX = margin;
    const tableWidth = 216 - margin * 2;
    const labelFill: [number, number, number] = [5, 37, 68]; // #052544
    const makeLabelCell = (label: string) => ({
      content: `${label}:`,
      styles: { fillColor: labelFill, textColor: 255 as number, fontStyle: 'bold' as const },
    });

    const rows: RowInput[] = [];
    const pushRow = (label: string, value: string) => {
      rows.push([
        makeLabelCell(label),
        { content: value || '-' },
      ]);
    };

    pushRow('NOMBRES', (data.nombreCompleto || '').split(' ').slice(0, -1).join(' ') || data.nombreCompleto || '-');
    // Apellidos: si es posible, lo derivamos del final del nombreCompleto (heurística simple)
    const possibleAp = (data.nombreCompleto || '').split(' ').slice(-1).join(' ');
    pushRow('APELLIDOS', possibleAp || '-');

    // Fila de C.I. con 3 celdas en el valor: Nº:, EXPEDIDO:, Nº DE CELULAR:
    // Dejamos el contenido vacío y lo dibujamos manualmente en didDrawCell para aplicar negritas parciales
    const ciRowIndex = rows.length;
    const ciValue = (data.ci || '-').toString();
    const expValue = (data.expedicion || '-').toString();
    const celValue = (data.celular || '-').toString();
    rows.push([
      makeLabelCell('CÉDULA DE IDENTIDAD'),
      { content: '' },
    ]);

    pushRow('INSTITUTO', data.instituto || 'INSTITUTO TECNOLÓGICO DE ENSEÑANZA AUTOMOTRIZ "CETA"');
    pushRow('CARRERA', data.carrera || '-');
    pushRow('MODALIDAD DE GRADUACIÓN', data.modalidad || '-');
    pushRow('NOMBRE/TEMA', data.tema || '-');
    pushRow('OBJETIVOS', (data.objetivo || '').toString());

    doc.setTextColor(0, 0, 0);
    autoTable(doc, {
      startY: y + 4,
      margin: { left: tableMarginX, right: tableMarginX },
      tableWidth: tableWidth,
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 3, overflow: 'linebreak', textColor: 0 },
      columnStyles: {
        0: { cellWidth: 60 }, // ancho de la columna de etiquetas
        1: { cellWidth: tableWidth - 60 },
      },
      body: rows,
      theme: 'grid',
      didDrawCell: (dataArg) => {
        // Renderizado manual para la fila de C.I. (columna de valores) con negritas parciales
        if (dataArg.section === 'body' && dataArg.row.index === ciRowIndex && dataArg.column.index === 1) {
          const { cell } = dataArg;
          const x = cell.x + 2;
          const yText = cell.y + 5.5; // alineación aproximada
          let xPos = x;
          const draw = (text: string) => {
            dataArg.doc.setTextColor(0, 0, 0);
            dataArg.doc.setFont('helvetica', 'bold');
            dataArg.doc.text(text, xPos, yText);
            xPos += dataArg.doc.getTextWidth(text);
          };
          draw('Nº: ');
          draw(ciValue + '   ');
          draw('EXPEDIDO: ');
          draw(expValue + '   ');
          draw('Nº DE CELULAR: ');
          draw(celValue);
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY || y + 40;

    // Declaraciones y declaración final con renderizado justificado dentro de márgenes
    y += 8;
    const decl1 = '1.  A la fecha declaro que tengo definido el tema de la modalidad de graduación, por lo cual solicito proseguir como corresponda.';
    const decl2 = '2.  De existir algún impedimento académico para continuar con el proceso de modalidad de graduación se solicita se notifique para tomar las acciones correctivas.';
    const nombreAyN = ((data.apellidos || '').trim() + ' ' + (data.nombres || '').trim()).trim();
    const nombreParaMostrar = nombreAyN || (data.nombreCompleto || '-');
    const ciExp = `${data.ci || '-'} ${data.expedicion || ''}`.trim();
    const yoLinea = `Yo ${nombreParaMostrar} con C.I. ${ciExp}, declaro que todos los datos consignados en el presente formulario son verídicos.`;

    const drawJustified = (text: string, xLeft: number, xRight: number, startY: number, lineHeight = 6) => {
      const maxWidth = xRight - xLeft;
      const words = text.split(/\s+/).filter(Boolean);
      let line: string[] = [];
      let yPos = startY;
      const spaceW = doc.getTextWidth(' ');
      const flushLine = (isLast: boolean) => {
        const lineText = line.join(' ');
        const textW = doc.getTextWidth(lineText);
        if (isLast || line.length <= 1 || textW >= maxWidth) {
          // Última línea o una sola palabra: dibujar normal (izquierda)
          doc.text(lineText, xLeft, yPos);
        } else {
          // Distribuir espacios extra
          const wordsW = line.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
          const gaps = line.length - 1;
          const extraTotal = Math.max(0, maxWidth - wordsW);
          const extraPerGap = (extraTotal - gaps * spaceW) / gaps + spaceW; // base espacio + extra
          let x = xLeft;
          for (let i = 0; i < line.length; i++) {
            const w = line[i];
            doc.text(w, x, yPos);
            const wW = doc.getTextWidth(w);
            x += wW + (i < line.length - 1 ? extraPerGap : 0);
          }
        }
        yPos += lineHeight;
      };
      let currentW = 0;
      for (const w of words) {
        const wW = doc.getTextWidth(w);
        const needed = (line.length === 0 ? 0 : spaceW) + wW;
        if (currentW + needed <= maxWidth) {
          line.push(w);
          currentW += needed;
        } else {
          flushLine(false);
          line = [w];
          currentW = wW;
        }
      }
      if (line.length) flushLine(true);
      return yPos;
    };

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const xLeft = margin;
    const xRight = 216 - margin;
    y = drawJustified(decl1, xLeft, xRight, y);
    y = drawJustified(decl2, xLeft, xRight, y);
    // Espacio antes del párrafo final
    y += 4;
    // Línea final "Yo ..." justificada con negritas parciales
    const segments: { text: string; style: 'normal' | 'bold' }[] = [
      { text: 'Yo', style: 'normal' },
      { text: nombreParaMostrar, style: 'bold' },
      { text: 'con C.I.', style: 'normal' },
      { text: ciExp, style: 'bold' },
      { text: ', declaro que todos los datos consignados en el presente formulario son verídicos.', style: 'normal' },
    ];
    const drawJustifiedStyled = (
      segs: { text: string; style: 'normal' | 'bold' }[],
      xL: number,
      xR: number,
      startY: number,
      lineHeight = 6
    ) => {
      // Tokenizar en palabras preservando estilo
      type Tok = { w: string; s: 'normal' | 'bold' };
      const toks: Tok[] = [];
      segs.forEach((seg) => {
        const parts = seg.text.split(/\s+/).filter(Boolean);
        parts.forEach((p, idx) => toks.push({ w: p + (idx < parts.length - 1 ? '' : ''), s: seg.style }));
      });
      let yPos = startY;
      let line: Tok[] = [];
      const maxW = xR - xL;
      const measure = (t: Tok) => {
        doc.setFont('helvetica', t.s);
        return doc.getTextWidth(t.w);
      };
      const spaceW = doc.getTextWidth(' ');
      const flush = (isLast: boolean) => {
        const wordsW = line.reduce((sum, t) => sum + (doc.setFont('helvetica', t.s), doc.getTextWidth(t.w)), 0);
        const gaps = Math.max(0, line.length - 1);
        if (isLast || gaps === 0) {
          let x = xL;
          line.forEach((t, i) => {
            doc.setFont('helvetica', t.s);
            doc.text(t.w, x, yPos);
            x += doc.getTextWidth(t.w) + (i < line.length - 1 ? spaceW : 0);
          });
        } else {
          const baseSpaces = gaps * spaceW;
          const extra = Math.max(0, maxW - wordsW);
          const extraPerGap = (extra - baseSpaces) / gaps + spaceW;
          let x = xL;
          line.forEach((t, i) => {
            doc.setFont('helvetica', t.s);
            doc.text(t.w, x, yPos);
            x += doc.getTextWidth(t.w) + (i < line.length - 1 ? extraPerGap : 0);
          });
        }
        yPos += lineHeight;
      };
      let currentW = 0;
      for (const tk of toks) {
        const wW = measure(tk);
        const need = (line.length === 0 ? 0 : spaceW) + wW;
        if (currentW + need <= maxW) {
          line.push(tk);
          currentW += need;
        } else {
          flush(false);
          line = [tk];
          currentW = wW;
        }
      }
      if (line.length) flush(true);
      return yPos;
    };
    y = drawJustifiedStyled(segments, xLeft, xRight, y);
    y += 14;
    y += 14;

    // Firma estudiante centrada
    const lineW = 60;
    doc.line(108.5 - lineW / 2, y, 108.5 + lineW / 2, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Firma de la o el estudiante', 108.5, y, { align: 'center' });
    y += 12;

    // Ciudad y fecha
    doc.text('Cochabamba,', 108.5, y, { align: 'center' });
    y += 14;

    // Nota en recuadro (centrado, Helvetica, "NOTA:" en bold y resto en itálica, caja más delgada)
    const notaPrefix = 'NOTA:';
    const notaResto = 'El contenido de la presente declaración es de exclusiva responsabilidad del declarante.';
    const notaW = 216 - margin * 1.5;
    const notaH = 7; // más delgado en altura
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6); // borde más delgado
    doc.rect(margin, y, notaW, notaH);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    // Calcular ancho total considerando estilos
    doc.setFont('helvetica', 'bold');
    const wPrefix = doc.getTextWidth(notaPrefix + ' ');
    doc.setFont('helvetica', 'italic');
    const wResto = doc.getTextWidth(notaResto);
    const total = wPrefix + wResto;
    const xStart = margin + Math.max(2, (notaW - total) / 2);
    const yMiddle = y + notaH / 2 + 2.1; // baseline centrada para altura 7
    // Dibujar centrado
    let cx = xStart;
    doc.setFont('helvetica', 'bold');
    doc.text(notaPrefix + ' ', cx, yMiddle);
    cx += wPrefix;
    doc.setFont('helvetica', 'italic');
    doc.text(notaResto, cx, yMiddle);

    // Guardar
    doc.save('FMDG-1.pdf');
  }
}
