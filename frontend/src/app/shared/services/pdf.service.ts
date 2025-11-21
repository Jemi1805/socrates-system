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
  postulanteNumero?: number | string;
  modalidad?: string;
  tema?: string;
  objetivo?: string;
  // Datos opcionales para carátula (segunda página)
  caratulaPostulanteNumero?: number | string;
  caratulaGestion?: string;
  caratulaTutor?: string;
  caratulaArea?: string;
}

export interface TutorDesignacionPdfData {
  tutorNombre: string;
  tutorApellidoP?: string;
  tutorApellidoM?: string;
  tutorNombres?: string;
  tutorTipo?: string;
  tutorTitulo?: string;
  tutorTituloAcademico?: string;
  tutorCi?: string;
  tutorCelular?: string;
  area?: string;
  estudianteNombre?: string;
  estudianteCodigo?: string;
  carrera?: string;
  modalidad?: string;
  proyectoNombre?: string;
  convocatoria?: string;
  convocatoriaFechaInicio?: string | Date;
  convocatoriaFechaFin?: string | Date;
  fecha?: string | Date;
  lugar?: string;
  referencia?: string;
  numeroDocumento?: string;
  cite?: string;
  formatoCodigo?: string;
  paraNombre?: string;
  paraCargo?: string;
  deNombre?: string;
  deCargo?: string;
  asunto?: string;
  introduccion?: string;
  cronogramaInicio?: string | Date;
  cronogramaFin?: string | Date;
  cierre?: string;
  elaboradoPor?: string;
  cargoElaborador?: string;
  observaciones?: string;
  responsabilidades?: string[];
  pieNotas?: string[];
  estudiantes?: TutorDesignacionEstudiante[];
  fechaGeneracion?: string | Date;
  // Campos opcionales para carátula adjunta
  caratulaPostulanteNumero?: number | string;
  caratulaGestion?: string;
  caratulaTutor?: string;
  caratulaArea?: string;
}

export interface TutorDesignacionEstudiante {
  nombre: string;
  codigo?: string;
  carrera?: string;
  modalidad?: string;
  area?: string;
  tema?: string;
  fechaDesignacion?: string | Date;
}

const formatFechaLatam = (fecha?: string | Date | number | null): string | null => {
  if (fecha === null || fecha === undefined) return null;

  const buildDate = (): Date | null => {
    if (fecha instanceof Date) return fecha;

    if (typeof fecha === 'number') {
      const fromNumber = new Date(fecha);
      return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
    }

    if (typeof fecha === 'string') {
      const trimmed = fecha.trim();
      if (!trimmed) return null;

      const slashMatch = trimmed.match(/^([0-3]?\d)\/(0[1-9]|1[0-2])\/(\d{4})$/);
      if (slashMatch) {
        const day = Number(slashMatch[1]);
        const month = Number(slashMatch[2]) - 1;
        const year = Number(slashMatch[3]);
        const candidate = new Date(year, month, day);
        if (
          candidate.getFullYear() === year &&
          candidate.getMonth() === month &&
          candidate.getDate() === day
        ) {
          return candidate;
        }
        return null;
      }

      // Manejar YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS como fecha local para evitar desfase por zona horaria
      const isoYMD = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
      if (isoYMD) {
        const year = Number(isoYMD[1]);
        const month = Number(isoYMD[2]) - 1;
        const day = Number(isoYMD[3]);
        const candidate = new Date(year, month, day);
        if (
          candidate.getFullYear() === year &&
          candidate.getMonth() === month &&
          candidate.getDate() === day
        ) {
          return candidate;
        }
        return null;
      }

      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  };

  try {
    const date = buildDate();
    if (!date) return null;
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dia = date.getDate();
    const mes = meses[date.getMonth()] ?? '';
    const anio = date.getFullYear();
    if (!mes) return null;
    return `${dia} de ${mes} de ${anio}`;
  } catch {
    return null;
  }
};

@Injectable({ providedIn: 'root' })
export class PdfService {
  private verdanaReady = false;
  private verdanaUnavailable = true;
  private bookmanReady = false;
  private bookmanTried = false;

  private async arrayBufferToBase64(buf: ArrayBuffer): Promise<string> {
    let binary = '';
    const bytes = new Uint8Array(buf);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  private async flattenToPng(dataUrl: string, bgColor = '#FFFFFF'): Promise<string> {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        const padRatio = 0.06;
        const padW = Math.round(srcW * padRatio);
        const padH = Math.round(srcH * padRatio);
        const outW = srcW + padW * 2;
        const outH = srcH + padH * 2;
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No 2D context')); return; }
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, padW, padH, srcW, srcH);
        try {
          const png = canvas.toDataURL('image/png');
          resolve(png);
        } catch (e) { reject(e); }
      };
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
  }

  private async flattenToJpeg(dataUrl: string, bgColor = '#FFFFFF'): Promise<string> {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        const padRatio = 0.06; // 6% de padding blanco alrededor
        const padW = Math.round(srcW * padRatio);
        const padH = Math.round(srcH * padRatio);
        const outW = srcW + padW * 2;
        const outH = srcH + padH * 2;
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No 2D context')); return; }
        // Fondo blanco para aplanar la transparencia
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, padW, padH, srcW, srcH);
        try {
          const jpeg = canvas.toDataURL('image/jpeg', 1.0);
          resolve(jpeg);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
  }

  private async ensureVerdana(doc: jsPDF): Promise<boolean> {
    if (this.verdanaUnavailable) return false;
    if (this.verdanaReady) return true;
    return false;
  }
  private async ensureBookman(doc: jsPDF): Promise<boolean> {
    if (this.bookmanReady) return true;
    if (this.bookmanTried) return false;
    this.bookmanTried = true;
    try {
      const res = await fetch('assets/fonts/BookmanOldStyle.ttf');
      if (!res.ok) throw new Error('Bookman normal not found');
      const buf = await res.arrayBuffer();
      const b64 = await this.arrayBufferToBase64(buf);
      doc.addFileToVFS('BookmanOldStyle.ttf', b64);
      doc.addFont('BookmanOldStyle.ttf', 'BookmanOldStyle', 'normal');
      try {
        const resB = await fetch('assets/fonts/BookmanOldStyle-Bold.ttf');
        if (!resB.ok) throw new Error('Bookman bold not found');
        const bufB = await resB.arrayBuffer();
        const b64B = await this.arrayBufferToBase64(bufB);
        doc.addFileToVFS('BookmanOldStyle-Bold.ttf', b64B);
        doc.addFont('BookmanOldStyle-Bold.ttf', 'BookmanOldStyle', 'bold');
      } catch {
        doc.addFont('BookmanOldStyle.ttf', 'BookmanOldStyle', 'bold');
      }
      this.bookmanReady = true;
      return true;
    } catch {
      return false;
    }
  }
  private safeSetFont(doc: jsPDF, family: string, style: 'normal' | 'bold' = 'normal') {
    try {
      doc.setFont(family, style);
    } catch {
      doc.setFont('helvetica', style);
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

  private async loadImageWithMeta(url: string): Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number; }> {
    // Obtiene dataUrl y dimensiones naturales para preservar proporción
    const dataUrl = await this.loadImageDataUrl(url);
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ dataUrl, naturalWidth: img.naturalWidth || img.width, naturalHeight: img.naturalHeight || img.height });
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
  }

  async generarFMDG1(
    data: Fmdg1Data,
    options?: { logoUrl?: string; logoWidthMm?: number; logoMaxHeightMm?: number; logoBgColor?: string; logoFormat?: 'PNG' | 'JPEG'; behavior?: 'download' | 'view' }
  ) {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' }); // 216 x 279 mm aprox
    // Usaremos la fuente por defecto (Helvetica)

    const margin = 15;
    let y = margin;

    // Encabezado con logo (preservando proporción)
    const logoUrl = options?.logoUrl || 'assets/images/LOGO.png';
    try {
      const meta = await this.loadImageWithMeta(logoUrl);
      const logoW = options?.logoWidthMm ?? 22; // ancho deseado en mm
      const aspect = meta.naturalHeight > 0 ? meta.naturalWidth / meta.naturalHeight : 1; // w/h
      const maxH = options?.logoMaxHeightMm ?? 26; // altura máxima en mm
      // Limitar por ancho y por altura manteniendo proporción
      const maxWByHeight = maxH * aspect;
      const finalW = Math.min(logoW, maxWByHeight);
      const finalH = finalW / (aspect || 1);
      // Aplanar sobre fondo para evitar artefactos de alpha
      const useFormat = options?.logoFormat || 'PNG';
      if (useFormat === 'JPEG') {
        const flatJpeg = await this.flattenToJpeg(meta.dataUrl, options?.logoBgColor || '#FFFFFF');
        doc.addImage(flatJpeg, 'JPEG', margin, y - 2, finalW, finalH, undefined, 'SLOW');
      } else {
        const flatPng = await this.flattenToPng(meta.dataUrl, options?.logoBgColor || '#FFFFFF');
        doc.addImage(flatPng, 'PNG', margin, y - 2, finalW, finalH, undefined, 'SLOW');
      }
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
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const instText = 'INSTITUTO TECNOLÓGICO DE ENSEÑANZA AUTOMOTRIZ';
    doc.text(instText, 108.5, y, { align: 'center' });
    underlineCentered(instText, y);
    y += 8; // más espacio después del instituto
    doc.setFontSize(15);
    const cetaText = '"CETA"';
    doc.text(cetaText, 108.5, y, { align: 'center' });
    underlineCentered(cetaText, y);
    y += 6; // más espacio después de "CETA"
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
    doc.setFontSize(17);
    const titText = 'FORMULARIO DE MODALIDAD DE GRADUACIÓN (FMDG-1)';
    doc.text(titText, 108.5, y, { align: 'center' });
    underlineCentered(titText, y);
    y += 6; // más espacio después de "CETA"

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
    const notaW = 216 - margin * 2;
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

    

    if (options?.behavior === 'view') {
      try {
        const url = doc.output('bloburl');
        window.open(url, '_blank');
      } catch {
        (doc as any).output('dataurlnewwindow');
      }
    } else {
      doc.save('FMDG-1.pdf');
    }
  }

  async generarDesignacionTutorPdf(
    data: TutorDesignacionPdfData,
    options?: { fileName?: string; logoUrl?: string; logoWidthMm?: number; logoMaxHeightMm?: number; logoBgColor?: string; logoFormat?: 'PNG' | 'JPEG'; behavior?: 'download' | 'view' }
  ) {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 30;
    const marginY = 20;
    const headerHeight = 26;
    const headerOffsetX = 20;
    const headerOffsetY = 15;
    const headerRightMargin = 15;
    const contentRightMargin = 25;
    const labelRightMargin = 15;
    const baseFont = 'helvetica';
    const primaryTabStop = 12;
    const nestedTabStop = 34;
    const labelColumnIndent = 12;

    const logoUrl = options?.logoUrl || 'assets/images/LOGO.png';
    let logoMeta: { dataUrl: string; naturalWidth: number; naturalHeight: number; } | null = null;
    let logoImage: string | null = null;
    try {
      logoMeta = await this.loadImageWithMeta(logoUrl);
      const flattened = await this.flattenToPng(logoMeta.dataUrl, options?.logoBgColor || '#FFFFFF');
      logoImage = flattened;
    } catch {
      logoMeta = null;
      logoImage = null;
    }

    const toDate = (value?: string | Date | null): Date | null => {
      if (value == null) return null;
      if (value instanceof Date) return value;
      const s = String(value).trim();
      if (!s) return null;
      // dd/mm/yyyy (local)
      const m1 = s.match(/^([0-3]?\d)\/(0[1-9]|1[0-2])\/(\d{4})$/);
      if (m1) {
        const d = Number(m1[1]);
        const m = Number(m1[2]) - 1;
        const y = Number(m1[3]);
        return new Date(y, m, d);
      }
      // yyyy-mm-dd (local)
      const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m2) {
        const y = Number(m2[1]);
        const m = Number(m2[2]) - 1;
        const d = Number(m2[3]);
        return new Date(y, m, d);
      }
      const parsed = new Date(s);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    };

    const pad2 = (num: number): string => String(num).padStart(2, '0');

    const now = new Date();

    const formatDateShort = (value?: string | Date | null, fallback: string = ''): string => {
      const date = toDate(value);
      if (!date) return fallback || '';
      return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
    };

    const formatDate = (value?: string | Date | null, fallback: string = ''): string => {
      const date = toDate(value);
      if (!date) return fallback || '';
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      return `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
    };

    const formatCronograma = (): string => {
      const inicio = formatDate(data.cronogramaInicio, '___');
      const fin = formatDate(data.cronogramaFin, '___');
      return `${inicio} al ${fin}`;
    };

    const tutorTypeRaw = (data.tutorTipo || '').toString();
    const tutorTypeLower = tutorTypeRaw.toLowerCase().trim();
    const isMemorandum = tutorTypeLower.includes('planta') || tutorTypeLower.includes('interno');
    const headerTitle = isMemorandum ? 'MEMORÁNDUM' : 'COMUNICACIÓN INTERNA';

    const normalizeNumber = (value?: string | number | null): string => {
      if (value === null || value === undefined) return '___';
      const raw = String(value).trim();
      if (!raw) return '___';
      const digits = raw.replace(/\D/g, '');
      if (digits.length) {
        return digits.padStart(3, '0');
      }
      return raw;
    };

    const citeValue = (() => {
      if (data.cite && data.cite.trim().length) return data.cite.trim();
      const year = String(now.getFullYear());
      const numero = normalizeNumber(data.numeroDocumento);
      return isMemorandum ? `CETA/DA/MEM/${year}/${numero}` : `CETA/DA/COMINT/${year}/${numero}`;
    })();
    const paraCargoResolved = (() => {
      const raw = (data.paraCargo || '').toString().trim();
      if (raw) {
        return raw;
      }
      const tutorTitleFallback = (data.tutorTitulo || data.tutorTituloAcademico || '').toString().trim();
      if (tutorTitleFallback) {
        return tutorTitleFallback;
      }
      const tipoTutor = (data.tutorTipo || '').toString().trim();
      if (tipoTutor) {
        return tipoTutor;
      }
      return 'DOCENTE TÉCNICO';
    })();

    const buildParaNombre = (): string | null => {
      const tituloAcadRaw = (data.tutorTituloAcademico || '').toString().trim();
      const tituloNormalized = tituloAcadRaw ? tituloAcadRaw.replace(/\.+$/, '').toUpperCase() : '';
      const prefijo = tituloNormalized ? `${tituloNormalized}.` : '';
      const parts: string[] = [];
      if (prefijo) parts.push(prefijo);
      const apP = (data.tutorApellidoP || '').toString().trim();
      const apM = (data.tutorApellidoM || '').toString().trim();
      let nombres = (data.tutorNombres || '').toString().trim();
      if (!nombres && !apP && !apM) {
        nombres = (data.tutorNombre || '').toString().trim();
      } else if (!nombres) {
        const fallback = (data.tutorNombre || '').toString().trim();
        if (fallback) {
          const tokens = fallback.split(/\s+/).filter(Boolean);
          const surnames = new Set([apP.toLowerCase(), apM.toLowerCase()].filter(Boolean));
          const filtered = tokens.filter(tok => !surnames.has(tok.toLowerCase()));
          nombres = filtered.join(' ').trim();
        }
      }
      if (apP) parts.push(apP);
      if (apM) parts.push(apM);
      if (nombres) parts.push(nombres);
      const deduped: string[] = [];
      const seen = new Set<string>();
      parts.forEach(part => {
        const norm = part.toLowerCase();
        if (!seen.has(norm)) {
          seen.add(norm);
          deduped.push(part);
        }
      });
      const joined = deduped.join(' ').replace(/\s+/g, ' ').trim();
      return joined || null;
    };

    const resolvedParaNombre = (() => {
      if (data.paraNombre && data.paraNombre.trim().length) {
        return data.paraNombre.trim();
      }
      return buildParaNombre();
    })();

    const estudianteRows = (): TutorDesignacionEstudiante[] => {
      if (data.estudiantes && data.estudiantes.length) {
        return data.estudiantes.map((est) => ({
          nombre: est.nombre,
          carrera: est.carrera || data.carrera,
          modalidad: (() => {
            if (est.modalidad && est.modalidad.trim().length) return est.modalidad;
            if (data.modalidad && data.modalidad.trim().length) return data.modalidad;
            return 'Proyecto de Grado';
          })(),
          area: est.area || data.area,
          tema: est.tema || data.proyectoNombre,
        }));
      }

      if (data.estudianteNombre) {
        return [{
          nombre: data.estudianteNombre,
          carrera: data.carrera,
          modalidad: data.modalidad && data.modalidad.trim().length ? data.modalidad : 'Proyecto de Grado',
          area: data.area,
          tema: data.proyectoNombre,
        }];
      }

      return [];
    };

    const renderHeader = (pageIndex: number, totalPages: number, opts: { clear?: boolean } = {}) => {
      if (opts.clear) {
        doc.setFillColor(255, 255, 255);
        doc.rect(headerOffsetX, headerOffsetY, pageWidth - headerOffsetX - headerRightMargin, headerHeight, 'F');
      }

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      const headerWidth = pageWidth - headerOffsetX - headerRightMargin;
      doc.rect(headerOffsetX, headerOffsetY, headerWidth, headerHeight);

      const logoBoxWidth = 26;
      const logoBoxHeight = headerHeight;
      const logoX = headerOffsetX;
      const logoY = headerOffsetY;
      doc.setFillColor(255, 255, 255);
      doc.rect(logoX, logoY, logoBoxWidth, logoBoxHeight, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.rect(logoX, logoY, logoBoxWidth, logoBoxHeight);

      if (logoMeta) {
        const aspect = logoMeta.naturalHeight ? logoMeta.naturalWidth / logoMeta.naturalHeight : 1;
        const availableW = logoBoxWidth - 4;
        const availableH = logoBoxHeight - 4;
        let imgW = availableW;
        let imgH = imgW / (aspect || 1);
        if (imgH > availableH) {
          imgH = availableH;
          imgW = imgH * (aspect || 1);
        }
        const imgX = logoX + (logoBoxWidth - imgW) / 2;
        const imgY = logoY + (logoBoxHeight - imgH) / 2;
        const imageSource = logoImage || logoMeta.dataUrl;
        doc.addImage(imageSource, 'PNG', imgX, imgY, imgW, imgH, undefined, 'FAST');
      }

      const infoWidth = 55;
      const availableCenterWidth = headerWidth - logoBoxWidth - infoWidth;
      const centerX = headerOffsetX + logoBoxWidth + availableCenterWidth / 2;

      const headerColor: [number, number, number] = [5, 37, 68];
      doc.setTextColor(...headerColor);

      doc.setFont(baseFont, 'bold');
      doc.setFontSize(11);
      doc.text('Instituto Tecnológico de Enseñanza Automotriz', centerX, headerOffsetY + 5.4, { align: 'center' });
      doc.setFontSize(11);
      doc.text('"CETA"', centerX, headerOffsetY + 10.2, { align: 'center' });

      doc.setDrawColor(...headerColor);
      const centerLeft = headerOffsetX + logoBoxWidth;
      const centerRight = headerOffsetX + headerWidth - infoWidth;
      doc.line(centerLeft, headerOffsetY + (headerHeight / 2), centerRight, headerOffsetY + (headerHeight / 2));
      doc.setDrawColor(0, 0, 0);

      doc.setFontSize(14);
      doc.setFont(baseFont, 'bold');
      doc.text(headerTitle, centerX, headerOffsetY + (headerHeight / 2) + 8.5, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      const infoX = headerOffsetX + headerWidth - infoWidth;
      const infoY = headerOffsetY;
      const infoRowHeight = headerHeight / 3;
      const fechaFuente = data.fechaGeneracion ?? data.fecha;
      const fechaTexto = formatDateShort(fechaFuente, formatDateShort(new Date(), ''));
      const citeTexto = citeValue;
      const total = Math.max(totalPages, pageIndex);
      const hojaTexto = `${pageIndex} de ${total}`;

      const infoRows: Array<{ label: string; value: string; }> = [
        { label: 'Fecha:', value: fechaTexto },
        { label: 'Cite:', value: citeTexto },
        { label: 'Fojas:', value: hojaTexto },
      ];

      infoRows.forEach((row: { label: string; value: string; }, idx: number) => {
        const yStart = infoY + idx * infoRowHeight;
        doc.rect(infoX, yStart, infoWidth, infoRowHeight);
        const labelBaseline = yStart + infoRowHeight / 2 + 1;
        doc.setFont(baseFont, 'bold');
        doc.setFontSize(10);
        doc.text(row.label, infoX + 2, labelBaseline);
        doc.setFont(baseFont, 'normal');
        doc.setFontSize(9);
        doc.text((row.value || '').trim(), infoX + infoWidth - 2, labelBaseline, { align: 'right' });
      });
    };

    const refreshHeaders = () => {
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        renderHeader(i, total, { clear: true });
      }
      doc.setPage(total);
    };

    renderHeader(1, 1);

    const contentWidth = pageWidth - marginX - contentRightMargin;
    let cursorY = headerOffsetY + headerHeight + 8;

    const ensureSpace = (minSpace: number) => {
      if (cursorY + minSpace <= pageHeight - marginY) return;
      doc.addPage();
      renderHeader(doc.getNumberOfPages(), doc.getNumberOfPages());
      cursorY = headerOffsetY + headerHeight + 8;
    };

    const drawLabelValue = (
      label: string,
      value?: string | null,
      opts?: { uppercase?: boolean; boldValue?: boolean; lineSpacing?: number; indent?: number; labelWidthOverride?: number; tabStop?: number; labelBold?: boolean; rightMargin?: number }
    ): number => {
      if (value === null || value === undefined || value === '') {
        return opts?.labelWidthOverride ?? 0;
      }
      const lineSpacing = opts?.lineSpacing ?? 6;
      const startX = marginX + (opts?.indent ?? 0);
      const effectiveRightMargin = opts?.rightMargin ?? contentRightMargin;
      const contentEndX = pageWidth - effectiveRightMargin;
      ensureSpace(lineSpacing + 2);
      doc.setFont(baseFont, opts?.labelBold ? 'bold' : 'normal');
      doc.setFontSize(11);

      const labelText = label && label.trim().length ? label : '';
      if (labelText) {
        doc.text(labelText, startX, cursorY);
      }

      const measuredLabel = labelText ? doc.getTextWidth(labelText) : 0;
      const labelWidthOverride = opts?.labelWidthOverride ?? 0;
      const tabStop = opts?.tabStop ?? primaryTabStop;
      const valueOffset = Math.max(tabStop, Math.max(labelWidthOverride, measuredLabel) + (labelText ? 2 : 0));

      const rawValue = value ?? '';
      const preparedValue = opts?.uppercase ? rawValue.toString().toUpperCase() : rawValue.toString();
      const rightMarginBuffer = opts?.rightMargin ? 5 : 0;
      const availableWidth = Math.max(20, contentEndX - (startX + valueOffset) - rightMarginBuffer);
      const valueLines = doc.splitTextToSize(preparedValue, availableWidth) as string[];

      doc.setFont(baseFont, opts?.boldValue === false ? 'normal' : 'bold');
      doc.setFontSize(11);
      let currentY = cursorY;
      valueLines.forEach((line: string, idx: number) => {
        if (idx > 0) {
          currentY += lineSpacing;
          ensureSpace(lineSpacing + 2);
        }
        doc.text(line, startX + valueOffset, currentY);
      });

      cursorY = currentY + lineSpacing;
      return valueOffset;
    };

    const drawValueLine = (value?: string | null, opts?: { uppercase?: boolean; bold?: boolean; lineSpacing?: number; indent?: number }) => {
      if (!value) return;
      const lineSpacing = opts?.lineSpacing ?? 6;
      const startX = marginX + (opts?.indent ?? 0);
      ensureSpace(lineSpacing + 2);
      doc.setFont(baseFont, opts?.bold ? 'bold' : 'normal');
      doc.setFontSize(11);
      const textValue = opts?.uppercase ? value.toUpperCase() : value;
      doc.text(textValue, startX, cursorY);
      cursorY += lineSpacing;
    };

    const drawSectionTitle = (text: string) => {
      ensureSpace(8);
      doc.setFont(baseFont, 'bold');
      doc.setFontSize(11);
      doc.text(text, marginX, cursorY);
      cursorY += 6;
    };

    const drawParagraph = (text: string, spacing = 6, opts?: { indent?: number; firstLineOnly?: boolean; justify?: boolean }) => {
      if (!text) return;
      doc.setFont(baseFont, 'normal');
      doc.setFontSize(11);
      const indent = Math.max(0, opts?.indent ?? 0);
      const firstLineX = marginX + indent;
      const restLineX = opts?.firstLineOnly ? marginX : firstLineX;
      const contentEndX = marginX + contentWidth;
      const firstLineWidth = Math.max(20, contentEndX - firstLineX);
      const restLineWidth = Math.max(20, contentEndX - restLineX);
      const words = text.split(/\s+/).filter(Boolean);
      const spaceWidth = doc.getTextWidth(' ');
      const lines: string[][] = [];
      let currentLine: string[] = [];
      let currentWidth = 0;
      let isFirstLine = true;
      const getLimit = () => (isFirstLine ? firstLineWidth : restLineWidth);

      const pushLine = () => {
        if (currentLine.length) {
          lines.push([...currentLine]);
          currentLine = [];
          currentWidth = 0;
        }
      };

      words.forEach((word) => {
        const wordWidth = doc.getTextWidth(word);
        const extraSpace = currentLine.length === 0 ? 0 : spaceWidth;
        if (currentWidth + extraSpace + wordWidth <= getLimit() || currentLine.length === 0) {
          currentLine.push(word);
          currentWidth += extraSpace + wordWidth;
        } else {
          pushLine();
          isFirstLine = false;
          currentLine.push(word);
          currentWidth = wordWidth;
        }
      });
      pushLine();

      let first = true;
      lines.forEach((lineWords, index) => {
        ensureSpace(spacing + 2);
        const x = first ? firstLineX : restLineX;
        const limit = first ? firstLineWidth : restLineWidth;
        const gaps = Math.max(0, lineWords.length - 1);
        const isLastLine = index === lines.length - 1;
        if (opts?.justify && !isLastLine && gaps > 0) {
          const wordsWidth = lineWords.reduce((sum, word) => sum + doc.getTextWidth(word), 0);
          const neededSpacing = Math.max(spaceWidth * gaps, limit - wordsWidth);
          const spacingWidth = neededSpacing / gaps;
          let xPos = x;
          lineWords.forEach((word, idx) => {
            doc.text(word, xPos, cursorY);
            const wWidth = doc.getTextWidth(word);
            if (idx < lineWords.length - 1) {
              xPos += wWidth + spacingWidth;
            }
          });
        } else {
          doc.text(lineWords.join(' '), x, cursorY);
        }
        cursorY += spacing;
        first = false;
      });
      cursorY += 2;
    };

    const normalizeCarrera = (value?: any): string | undefined => {
      const raw = (value == null ? '' : String(value)).trim();
      if (!raw) return undefined;
      const upper = raw.toUpperCase();
      if (upper === 'EEA') return 'Electricidad y Electrónica Automotriz';
      if (upper === 'MEA') return 'Mecánica Automotriz';
      if (upper.includes('EEA') && upper.includes('MEA')) return undefined;
      const norm = raw
        .normalize('NFD')
        .replace(/\p{Diacritic}+/gu, '')
        .toLowerCase();
      const hasElec = /\belect/.test(norm) || /\beea\b/.test(norm);
      const hasMec = /\bmec/.test(norm) || /\bmea\b/.test(norm);
      if (hasElec && hasMec) return undefined;
      if (hasElec) return 'Electricidad y Electrónica Automotriz';
      if (hasMec) return 'Mecánica Automotriz';
      return raw;
    };

    // Sección "Para"
    if (resolvedParaNombre) {
      const indent = drawLabelValue('Para:', resolvedParaNombre, { uppercase: false, boldValue: false, labelWidthOverride: 24, tabStop: 25, labelBold: true, rightMargin: labelRightMargin });
      const cargoLineRaw = paraCargoResolved;
      const cargoLine = cargoLineRaw.replace(/\s+/g, ' ').trim();
      if (cargoLine) {
        drawLabelValue('', cargoLine.toUpperCase(), { uppercase: false, boldValue: true, indent, tabStop: 0, labelBold: false, rightMargin: labelRightMargin });
      }
    }

    // Sección "De"
    const indentDe = drawLabelValue('De:', 'Ing. Bradley Jaillita Burgoa', { uppercase: false, boldValue: false, labelWidthOverride: 24, tabStop: 25, labelBold: true, rightMargin: labelRightMargin });
    drawValueLine('DIRECTOR ACADÉMICO', { uppercase: true, bold: true, lineSpacing: 8, indent: indentDe });

    // Sección "Asunto"
    drawLabelValue('Asunto:', 'DESIGNACIÓN COMO TUTOR PARA PROYECTOS DE DEFENSA DE GRADO', { uppercase: true, lineSpacing: 6, labelWidthOverride: 24, tabStop: 25, labelBold: true, rightMargin: labelRightMargin });

    // Separador
    ensureSpace(4);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(headerOffsetX, cursorY, pageWidth - labelRightMargin, cursorY);
    cursorY += 8;

    const renderStudents = (students: TutorDesignacionEstudiante[]) => {
      students.forEach((est, idx) => {
        ensureSpace(18);
        const carreraVal = normalizeCarrera(est.carrera) || normalizeCarrera((data as any)?.carrera) || '-';
        const fields: Array<{ label: string; value?: string | null; bold?: boolean }> = [
          { label: 'Nombre:', value: est.nombre || '-', bold: true },
          { label: 'Carrera:', value: carreraVal, bold: true },
          { label: 'Modalidad:', value: est.modalidad || data.modalidad || '-', bold: true },
          { label: 'Área:', value: est.area || '-', bold: true },
          { label: 'Tema:', value: est.tema || '-', bold: true },
        ];

        const firstLineIndent = primaryTabStop;

        fields.forEach(field => {
          drawLabelValue(field.label, field.value || '-', {
            boldValue: field.bold ?? false,
            lineSpacing: 6,
            indent: firstLineIndent,
            tabStop: nestedTabStop,
            rightMargin: contentRightMargin,
          });
        });

        cursorY += 2;
        if (idx < students.length - 1) {
          ensureSpace(10);
        }
      });
    };

    const students = estudianteRows();
    const introduccionTextoBase = 'En cumplimiento al Reglamento de Modalidades de Graduación de Institutos Técnicos y Tecnológicos de Carácter Fiscal, de Convenio y Privado aprobado por la Resolución Ministerial Nº 0487/2023 del 14 de junio de 2023 y del Reglamento Interno de Modalidades de Graduación del Instituto “CETA”, la Dirección Académica del Instituto, lo designa como Tutor para Defensas de Grado de los siguientes estudiantes:';
    const introduccionTexto = (data.introduccion && data.introduccion.trim().length)
      ? data.introduccion
      : introduccionTextoBase;

    drawParagraph(introduccionTexto, 6, { indent: labelColumnIndent, firstLineOnly: true, justify: true });
    cursorY += 2;
    if (students.length) {
      renderStudents(students);
      cursorY += 4;
    }

    const seguimientoTexto = data.observaciones || 'Por esta razón, se le solicita orientar y asesorar a los postulantes en la preparación de sus temas y realizar el correspondiente seguimiento y evaluación tanto de la parte teórica como práctica, a fin de que los mismos culminen satisfactoriamente,';

    const rawConvocatoriaInicio = data.convocatoriaFechaInicio ?? data.cronogramaInicio ?? null;
    const rawConvocatoriaFin = data.convocatoriaFechaFin ?? data.cronogramaFin ?? null;
    const convocatoriaInicio = formatFechaLatam(rawConvocatoriaInicio);
    const convocatoriaFin = formatFechaLatam(rawConvocatoriaFin);
    const cronogramaTexto = convocatoriaInicio && convocatoriaFin
      ? `este proceso académico se llevará a cabo bajo cronograma del ${convocatoriaInicio} al ${convocatoriaFin}.`
      : null;
    const seguimientoCronograma = cronogramaTexto
      ? `${seguimientoTexto} ${cronogramaTexto}`
      : seguimientoTexto;
    drawParagraph(seguimientoCronograma, 6, { indent: labelColumnIndent, firstLineOnly: true, justify: true });

    const cierreTexto = data.cierre || 'Seguro de que alcanzará y logrará los objetivos de esta labor y de su profesionalismo, le saludo deseándole éxito.';
    drawParagraph(cierreTexto, 6, { indent: labelColumnIndent, firstLineOnly: true, justify: true });

    const pieNotas = data.pieNotas && data.pieNotas.length ? data.pieNotas : ['BJB', 'CC: REC/DA'];
    if (pieNotas.length) {
      cursorY += 8;
      doc.setFont(baseFont, 'normal');
      doc.setFontSize(6);
      pieNotas.forEach((nota) => {
        ensureSpace(4);
        doc.setFont(baseFont, 'normal');
        doc.setFontSize(6);
        doc.text(nota, marginX, cursorY);
        cursorY += 4;
      });
    }

    refreshHeaders();

    // ----- Carátula adjunta (media hoja) al final, sin encabezado -----
    try {
      doc.addPage();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const mx = 12; // margen un poco menor para acercar al borde
      const topY = mx;
      const boxW = pageWidth - 2 * mx;
      const usableH = pageHeight - 2 * mx;
      const boxH = usableH * 0.55; // solo un poco más alto que media hoja
      const hasBookman = await this.ensureBookman(doc);
      const bookmanFont = hasBookman ? 'BookmanOldStyle' : baseFont;

      // Marco con bordes redondeados
      doc.setDrawColor(36, 114, 55);
      doc.setLineWidth(2.0);
      if ((doc as any).roundedRect) {
        (doc as any).roundedRect(mx, topY, boxW, boxH, 6, 6);
      } else {
        doc.rect(mx, topY, boxW, boxH);
      }

      // Encabezado institucional
      doc.setTextColor(5, 37, 68);
      this.safeSetFont(doc, bookmanFont, 'bold');
      doc.setFontSize(17);
      doc.text('INSTITUTO TECNOLÓGICO DE ENSEÑANZA AUTOMOTRIZ', pageWidth / 2, topY + 10, { align: 'center' });
      doc.setTextColor(215, 25, 32);
      this.safeSetFont(doc, bookmanFont, 'bold');
      doc.setFontSize(17);
      doc.text('"CETA"', pageWidth / 2, topY + 16, { align: 'center' });

      // Logo centrado
      try {
        const meta2 = await this.loadImageWithMeta('assets/images/LOGO.png');
        const desiredW = 44; // ~4.39 cm de ancho
        const aspect2 = meta2.naturalHeight ? meta2.naturalWidth / meta2.naturalHeight : 1;
        const finalW2 = desiredW;
        const finalH2 = desiredW / (aspect2 || 1);
        const cx = pageWidth / 2 - finalW2 / 2;
        const cy = topY + 20;
        const flatLogo = await this.flattenToPng(meta2.dataUrl, '#FFFFFF');
        doc.addImage(flatLogo, 'PNG', cx, cy, finalW2, finalH2, undefined, 'FAST');
      } catch {}

      // Bloque Gestión y Post.
      const rightX = pageWidth - mx - 55;
      const rightY = topY + 30; // bajar bloque gestión/post
      const computeGestion = (): string => {
        const si = (data as any).convocatoriaFechaInicio;
        const sf = (data as any).convocatoriaFechaFin;
        const d = toDate ? (toDate(si) || toDate(sf)) : (si ? new Date(si) : (sf ? new Date(sf) : null));
        if (d && !Number.isNaN(d.getTime())) {
          const m = d.getMonth() + 1;
          const y = d.getFullYear();
          return (m >= 2 && m <= 7) ? `I/${y}` : `II/${y}`;
        }
        return '';
      };
      const gestion = (data as any).caratulaGestion ? String((data as any).caratulaGestion).trim() : computeGestion();
      const postNumRaw = (data as any).caratulaPostulanteNumero;
      const postNum = (postNumRaw !== undefined && postNumRaw !== null && String(postNumRaw).trim() !== '') ? String(postNumRaw) : '-';

      // Centro del bloque de gestión/post
      const blockCenterX = rightX + 22;

      // Etiqueta GESTIÓN (rojo, fuente base)
      doc.setTextColor(215, 25, 32);
      doc.setFont(baseFont, 'bold');
      doc.setFontSize(14);
      doc.text('GESTIÓN:', blockCenterX, rightY, { align: 'center' });

      // Valor de gestión (azul, Bookman bold)
      doc.setTextColor(5, 37, 68);
      this.safeSetFont(doc, bookmanFont, 'bold');
      doc.setFontSize(18);
      doc.text(gestion || '-', blockCenterX, rightY + 8, { align: 'center' });

      // POST.: etiqueta + número en la misma línea, centrados como bloque
      const postY = rightY + 18;
      const postLabel = 'POST.:';
      doc.setFont(baseFont, 'bold');
      doc.setFontSize(14);
      const postLabelWidth = doc.getTextWidth(postLabel);

      this.safeSetFont(doc, bookmanFont, 'bold');
      doc.setFontSize(18);
      const postNumWidth = doc.getTextWidth(postNum || '-');
      const gap = 3; // espacio entre etiqueta y número
      const totalPostWidth = postLabelWidth + gap + postNumWidth;
      const startX = blockCenterX - totalPostWidth / 2;

      // Dibuja etiqueta POST. en rojo
      doc.setTextColor(215, 25, 32);
      doc.setFont(baseFont, 'bold');
      doc.setFontSize(14);
      doc.text(postLabel, startX, postY);

      // Dibuja número en azul Bookman bold al lado
      doc.setTextColor(5, 37, 68);
      this.safeSetFont(doc, bookmanFont, 'bold');
      doc.setFontSize(18);
      const numX = startX + postLabelWidth + gap;
      doc.text(postNum, numX, postY);

      // Título del proyecto (un poco más abajo para liberar aire arriba)
      const titleY = topY + 70;
      doc.setTextColor(215, 25, 32);
      this.safeSetFont(doc, bookmanFont, 'bold');
      doc.setFontSize(20);
      doc.text('TÍTULO DEL PROYECTO', pageWidth / 2, titleY, { align: 'center' });

      const temaTexto = ((data as any).proyectoNombre || '').toString().trim();
      doc.setTextColor(0, 0, 0);
      this.safeSetFont(doc, bookmanFont, 'bold');
      doc.setFontSize(16);
      // Más ancho: menos margen izquierdo/derecho, manteniendo centrado
      const temaWrapped = doc.splitTextToSize(temaTexto || '-', pageWidth - 2 * (mx + 12));
      doc.text(temaWrapped as any, pageWidth / 2, titleY + 8, { align: 'center' });

      // Filas informativas: POSTULANTE, TUTOR, CARRERA, ÁREA
      const infoStartY = titleY + 22 + (Array.isArray(temaWrapped) ? Math.max(0, (temaWrapped.length - 1) * 4) : 0);
      const labelColor: [number, number, number] = [215, 25, 32];
      const valueColor: [number, number, number] = [5, 37, 68];
      const drawRow = (label: string, value: string, yPos: number) => {
        this.safeSetFont(doc, bookmanFont, 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...labelColor);
        const labelX = mx + 8; // desplazar un poco hacia la izquierda
        doc.text(label, labelX, yPos);
        doc.setTextColor(...valueColor);
        this.safeSetFont(doc, bookmanFont, 'normal');
        doc.setFontSize(16);
        const val = (value || '-').toString();
        const valueX = labelX + doc.getTextWidth(label) + 4; // más espacio entre etiqueta y valor
        doc.text(val, valueX, yPos);
      };

      const postulanteNombre = ((data as any).estudianteNombre || '').toString().trim();
      drawRow('POSTULANTE:', postulanteNombre || '-', infoStartY);

      const tutorNomCaratula = (data as any).caratulaTutor
        ? String((data as any).caratulaTutor)
        : (resolvedParaNombre || (data as any).tutorNombre || '-');
      drawRow('TUTOR:', tutorNomCaratula || '-', infoStartY + 7);

      const carreraCaratula = normalizeCarrera((data as any).carrera) || '-';
      drawRow('CARRERA:', carreraCaratula.toString(), infoStartY + 14);

      const areaNom = (data as any).caratulaArea ? String((data as any).caratulaArea) : ((data as any).area || '-');
      drawRow('ÁREA:', areaNom || '-', infoStartY + 21);

      // Ubicar "COCHABAMBA - BOLIVIA" cerca del borde inferior verde
      doc.setTextColor(5, 37, 68);
      this.safeSetFont(doc, bookmanFont, 'bold');
      doc.setFontSize(16);
      doc.text('COCHABAMBA - BOLIVIA', pageWidth / 2, topY + boxH - 6, { align: 'center' });
    } catch (e) {
      try { console.error('Error renderizando carátula:', e); } catch {}
      // Fallback de emergencia: dibujar carátula simple con Helvetica
      try {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const mx = 15;
        const topY = mx;
        const boxW = pageWidth - 2 * mx;
        const boxH = (pageHeight - 2 * mx) / 2;
        doc.setDrawColor(36, 114, 55);
        doc.setLineWidth(2.0);
        if ((doc as any).roundedRect) {
          (doc as any).roundedRect(mx, topY, boxW, boxH, 6, 6);
        } else {
          doc.rect(mx, topY, boxW, boxH);
        }
        // Encabezado simple
        doc.setTextColor(5, 37, 68);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('INSTITUTO TECNOLÓGICO DE ENSEÑANZA AUTOMOTRIZ', pageWidth / 2, topY + 10, { align: 'center' });
        doc.setTextColor(215, 25, 32);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('"CETA"', pageWidth / 2, topY + 16, { align: 'center' });
        // Gestión y Post.
        const rightX = pageWidth - mx - 65;
        const rightY = topY + 20;
        doc.setTextColor(215, 25, 32);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('GESTIÓN:', rightX, rightY);
        doc.setTextColor(5, 37, 68);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        const gestionTxt = 'I/' + new Date().getFullYear();
        doc.text(gestionTxt, rightX + 2, rightY + 8);
        doc.setTextColor(215, 25, 32);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        const postLabel = 'POST.:';
        doc.text(postLabel, rightX, rightY + 18);
        doc.setTextColor(5, 37, 68);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        const postValueX = rightX + doc.getTextWidth(postLabel) + 2;
        const postNum = String((data as any).caratulaPostulanteNumero || '-');
        doc.text(postNum, postValueX, rightY + 18);
        // Título
        const titleY = topY + 60;
        doc.setTextColor(215, 25, 32);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('TÍTULO DEL PROYECTO', pageWidth / 2, titleY, { align: 'center' });
        const temaTexto = ((data as any).proyectoNombre || '').toString().trim();
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const temaWrapped = doc.splitTextToSize(temaTexto || '-', pageWidth - 2 * (mx + 20));
        doc.text(temaWrapped as any, pageWidth / 2, titleY + 8, { align: 'center' });
        // Filas
        const infoStartY = titleY + 24 + (Array.isArray(temaWrapped) ? Math.max(0, (temaWrapped.length - 1) * 5) : 0);
        const labelColor: [number, number, number] = [215, 25, 32];
        const valueColor: [number, number, number] = [5, 37, 68];
        const drawRow = (label: string, value: string, yPos: number) => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(...labelColor);
          const labelX = mx + 18;
          doc.text(label, labelX, yPos);
          doc.setTextColor(...valueColor);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          const val = (value || '-').toString();
          const valueX = labelX + doc.getTextWidth(label) + 4;
          doc.text(val, valueX, yPos);
        };
        const postulanteNombre = ((data as any).estudianteNombre || '').toString().trim();
        drawRow('POSTULANTE:', postulanteNombre || '-', infoStartY);
        const tutorNom = (data as any).caratulaTutor ? String((data as any).caratulaTutor) : ((data as any).tutorNombre || '-');
        drawRow('TUTOR:', tutorNom || '-', infoStartY + 12);
        const carreraCaratula = ((data as any).carrera || '-').toString();
        drawRow('CARRERA:', carreraCaratula, infoStartY + 24);
        const areaNom = (data as any).caratulaArea ? String((data as any).caratulaArea) : ((data as any).area || '-');
        drawRow('ÁREA:', areaNom || '-', infoStartY + 36);
        doc.setTextColor(5, 37, 68);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('COCHABAMBA - BOLIVIA', pageWidth / 2, topY + boxH - 8, { align: 'center' });
      } catch {}
    }

    const fileName = options?.fileName || `designacion-tutor-${(data.numeroDocumento || data.tutorNombre || 'documento')}.pdf`;
    if (options?.behavior === 'view') {
      try {
        const url = doc.output('bloburl');
        window.open(url, '_blank');
      } catch {
        (doc as any).output('dataurlnewwindow');
      }
    } else {
      doc.save(fileName);
    }
  }
}
