import jsPDF from 'jspdf';
import { LaudoForm, Engineer, BuildingTypology, ZoneType } from '../types';
import { DAMAGE_LOGIC } from '../constants';

const drawHeader = (doc: jsPDF, pageWidth: number, margin: number, logoLeft?: string, logoRight?: string): number => {
  const headerStart = 15;
  const logoBoxSizeRight = 24; 
  const logoBoxSizeLeft = 28; 
  const logoBaseline = headerStart + 17; 
  
  const contentStartX = margin + logoBoxSizeLeft;
  const contentEndX = pageWidth - margin - logoBoxSizeRight;
  const centerX = (contentStartX + contentEndX) / 2;

  let textY = headerStart;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DO PARANÁ', centerX, textY, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  textY += 5;
  doc.text('COORDENADORIA ESTADUAL DA DEFESA CIVIL', centerX, textY, { align: 'center' });
  textY += 5;
  doc.text('DIVISÃO DE CONTRATOS, CONVÊNIOS E FUNDOS', centerX, textY, { align: 'center' });
  textY += 5;
  doc.text('FUNDO ESTADUAL PARA CALAMIDADES PÚBLICAS', centerX, textY, { align: 'center' });

  const logoRightX = pageWidth - margin - logoBoxSizeRight;
  if (logoRight) {
     try {
        const props = doc.getImageProperties(logoRight);
        const ratio = props.width / props.height;
        let w = logoBoxSizeRight;
        let h = logoBoxSizeRight;
        if (ratio > 1) h = w / ratio; else w = h * ratio;
        const x = logoRightX + (logoBoxSizeRight - w) / 2;
        const y = logoBaseline - h;
        doc.addImage(logoRight, 'PNG', x, y, w, h);
     } catch(e) { console.warn("Error adding right logo", e); }
  } else {
      doc.setFillColor(234, 88, 12); 
      doc.rect(logoRightX, logoBaseline - logoBoxSizeRight, logoBoxSizeRight, logoBoxSizeRight, 'F');
  }

  const logoLeftX = margin;
  if (logoLeft) {
      try {
        const props = doc.getImageProperties(logoLeft);
        const ratio = props.width / props.height;
        let w = logoBoxSizeLeft;
        let h = logoBoxSizeLeft;
        if (ratio > 1) h = w / ratio; else w = h * ratio;
        const x = logoLeftX + (logoBoxSizeLeft - w) / 2;
        const y = logoBaseline - h;
        doc.addImage(logoLeft, 'PNG', x, y, w, h);
      } catch(e) { console.warn("Error adding left logo", e); }
  }

  return 50; 
};

const drawFooter = (doc: jsPDF, pageNumber: number, totalPages: number, pageWidth: number, pageHeight: number) => {
    const footerHeight = 25;
    const footerY = pageHeight - footerHeight; 
    const barHeight = 4; 
    const slantWidth = 6; 
    const splitRatio = 0.80; 
    const splitX = pageWidth * splitRatio;
    const gapSize = 1.5;

    doc.setFillColor(0, 91, 159); 
    doc.path([{ op: 'm', c: [0, footerY] }, { op: 'l', c: [splitX, footerY] }, { op: 'l', c: [splitX - slantWidth, footerY + barHeight] }, { op: 'l', c: [0, footerY + barHeight] }, { op: 'h' }]);
    doc.fill();
    
    const greenStartX = splitX + gapSize;
    doc.setFillColor(0, 157, 87); 
    doc.path([{ op: 'm', c: [greenStartX, footerY] }, { op: 'l', c: [pageWidth, footerY] }, { op: 'l', c: [pageWidth, footerY + barHeight] }, { op: 'l', c: [greenStartX - slantWidth, footerY + barHeight] }, { op: 'h' }]);
    doc.fill();

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0); 
    doc.setFont('helvetica', 'normal');
    let textY = footerY + barHeight + 5;
    const centerX = pageWidth / 2;
    doc.text('Palácio das Araucárias - 1º andar - Setor C | Centro Cívico | Curitiba/PR | CEP 80.530-140', centerX, textY, { align: 'center' });
    textY += 4;
    doc.text('E-mail: defesacivil@defesacivil.pr.gov.br | Fone: (41) 3281-2500', centerX, textY, { align: 'center' });
    textY += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('“Defesa Civil somos todos nós”', centerX, textY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(`${pageNumber}/${totalPages}`, pageWidth - 5, pageHeight - 3, { align: 'right' });
};

// Helper to crop image to a specific aspect ratio (Width/Height)
const cropImage = (base64: string, targetRatio: number): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const currentRatio = img.width / img.height;
            let newWidth = img.width;
            let newHeight = img.height;
            
            // If current is 'taller' than target (ratio smaller), we must crop height
            if (currentRatio < targetRatio) {
                newHeight = img.width / targetRatio;
            } 
            // If current is 'wider' than target, we usually keep it or crop width.
            else {
                 newWidth = img.height * targetRatio;
            }

            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            if(!ctx) { resolve(base64); return; }

            const startX = (img.width - newWidth) / 2;
            const startY = (img.height - newHeight) / 2;

            ctx.drawImage(img, startX, startY, newWidth, newHeight, 0, 0, newWidth, newHeight);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
};

export const generateLaudoPDF = async (
  data: LaudoForm, 
  selectedEngineer: Engineer,
  mode: 'save' | 'preview' = 'save',
  mapImage?: string,
  showPin: boolean = true
): Promise<string | void> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  const bottomMargin = 30; 
  
  // Standard Constants
  const FONT_SIZE_BODY = 10;
  const LINE_HEIGHT = 5; // mm per line approx

  let yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);

  const checkPageBreak = (heightNeeded: number) => {
    if (yPos + heightNeeded > pageHeight - bottomMargin) {
        doc.addPage();
        yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
        return true;
    }
    return false;
  };

  const formatValue = (value: string | undefined | null): string => {
    if (!value || value.trim() === '') return 'NÃO INFORMADO';
    return value.toUpperCase();
  };

  // Helper to print "Label: Value" with consistent formatting
  // If yPos is provided, it draws there. Otherwise current yPos.
  // Returns the height used.
  const printKeyValue = (label: string, value: string, xPos: number, currentY: number, maxWidth: number): number => {
    doc.setFontSize(FONT_SIZE_BODY);
    
    // Draw Label
    doc.setFont('helvetica', 'bold');
    doc.text(label, xPos, currentY);
    const labelWidth = doc.getTextWidth(label);
    
    // Draw Value
    doc.setFont('helvetica', 'normal');
    const valueX = xPos + labelWidth + 2; // Standard 2mm gap
    const valueWidth = maxWidth - labelWidth - 2;
    
    const splitValue = doc.splitTextToSize(value, valueWidth);
    doc.text(splitValue, valueX, currentY);
    
    return splitValue.length * LINE_HEIGHT;
  };

  yPos += 5; 
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LAUDO DE IMÓVEL AFETADO POR EVENTO CLIMÁTICO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // --- SEÇÃO 1 ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('1. LOCALIZAÇÃO, DATA E PROTOCOLO', margin + 2, yPos);
  yPos += 8;

  // Row 1: Municipio (Left) and Data (Right)
  // Calculate width for Municipio to not overlap Data
  const dateLabel = 'DATA DA VISTORIA:';
  const dateValue = new Date(data.data).toLocaleDateString('pt-BR');
  doc.setFontSize(FONT_SIZE_BODY);
  doc.setFont('helvetica', 'bold');
  const dateLabelWidth = doc.getTextWidth(dateLabel);
  doc.setFont('helvetica', 'normal');
  const dateValueWidth = doc.getTextWidth(dateValue);
  const totalDateWidth = dateLabelWidth + dateValueWidth + 4; // safety
  
  const municipioMaxWidth = contentWidth - totalDateWidth - 5; 

  printKeyValue('MUNICÍPIO:', formatValue(data.municipio), margin, yPos, municipioMaxWidth);
  
  // Draw Data aligned to right side or fixed offset
  // Let's fix it at a visually pleasing location (e.g. 60% of page) or right aligned
  const dateStartX = margin + 100;
  printKeyValue(dateLabel, dateValue, dateStartX, yPos, contentWidth - 100);
  
  yPos += LINE_HEIGHT + 2; 
  
  // Row 2: Protocolo
  const usedHeightProto = printKeyValue('PROTOCOLO:', formatValue(data.protocolo), margin, yPos, contentWidth);
  yPos += usedHeightProto + 2;

  yPos += 4; // Extra spacing before next section

  // --- SEÇÃO 2 ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('2. DADOS DO IMÓVEL', margin + 2, yPos);
  yPos += 8;

  const addFieldStack = (label: string, value: string, sameLine = false, xOffset = 0) => {
    // Calculate max width based on whether we share the line
    const availableWidth = sameLine ? (contentWidth/2) : contentWidth;
    // We adjust maxWidth passed to printKeyValue to account for the xOffset
    const height = printKeyValue(label, value, margin + xOffset, yPos, availableWidth - xOffset);
    if (!sameLine) {
        yPos += height + 2; // Vertical padding
    }
    return height;
  };

  addFieldStack('ZONA:', formatValue(data.zona));
  if (data.zona === ZoneType.URBANO) {
      addFieldStack('INDICAÇÃO FISCAL:', formatValue(data.indicacaoFiscal));
      addFieldStack('INSCRIÇÃO MUNICIPAL:', formatValue(data.inscricaoImobiliaria));
      addFieldStack('MATRÍCULA:', formatValue(data.matricula));
  } else {
      addFieldStack('NIRF / CIB:', formatValue(data.nirfCib));
      addFieldStack('INCRA:', formatValue(data.incra));
  }
  addFieldStack('PROPRIETÁRIO:', formatValue(data.proprietario));
  addFieldStack('REQUERENTE:', formatValue(data.requerente));
  
  addFieldStack('CPF DO REQUERENTE:', formatValue(data.cpfRequerente));
  
  let fullAddress = '';
  if (data.endereco || data.bairro || data.cep) {
      const parts = [];
      if (data.endereco) parts.push(data.endereco);
      if (data.bairro) parts.push(data.bairro);
      if (data.cep) parts.push(data.cep);
      fullAddress = parts.join(', ');
  }
  addFieldStack('ENDEREÇO:', formatValue(fullAddress));
  
  if (showPin) {
    addFieldStack('COORDENADAS:', `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`);
  } else {
    addFieldStack('COORDENADAS:', `NÃO ESPECIFICADO`);
  }
  
  addFieldStack('TIPOLOGIA:', formatValue(data.tipologia === BuildingTypology.OUTRO ? data.tipologiaOutro : data.tipologia));

  yPos += 2; 

  if (mapImage) {
      try {
          // Calculate available space on Page 1
          const availableHeight = (pageHeight - bottomMargin) - yPos - 5;
          const targetWidth = 180; // 18cm as requested
          
          let targetHeight = targetWidth / (16/9); 

          if (targetHeight > availableHeight) {
              targetHeight = availableHeight;
          }
          
          const targetRatio = targetWidth / targetHeight;

          // Crop image to this ratio
          const processedMap = await cropImage(mapImage, targetRatio);

          const mapX = (pageWidth - targetWidth) / 2;
          
          doc.addImage(processedMap, 'PNG', mapX, yPos, targetWidth, targetHeight);
          
          // Border
          doc.setDrawColor(0);
          doc.setLineWidth(1.0); 
          doc.rect(mapX, yPos, targetWidth, targetHeight, 'S');
          doc.setLineWidth(0.2); 
          
          yPos += targetHeight + 5;
      } catch(e) { console.error("Failed to embed map", e); }
  }

  doc.addPage();
  yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
  
  // --- SEÇÃO 3 ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('3. LEVANTAMENTO DE DANOS', margin + 2, yPos);
  yPos += 10;

  data.danos.forEach((dano, index) => {
    checkPageBreak(30); 
    
    // Reuse printKeyValue for consistency in title vs description spacing
    const title = `3.${index + 1}. ${dano.type.toUpperCase()}:`;
    const desc = dano.description || "Sem descrição detalhada.";
    
    // We want the title to be part of the text flow, but bold.
    // printKeyValue handles exactly "Label: Value" format
    const height = printKeyValue(title, desc, margin, yPos, contentWidth);
    yPos += height + 3;

    if (dano.photos.length > 0) {
      const photoWidth = (contentWidth - 6) / 2;
      const photoHeight = 55;
      const rowHeight = photoHeight + 6;
      for (let i = 0; i < dano.photos.length; i += 2) {
          const p1 = dano.photos[i];
          const p2 = dano.photos[i+1];
          if (yPos + photoHeight > pageHeight - bottomMargin) {
              doc.addPage();
              yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
          }
          if (p1) { try { doc.addImage(p1, 'JPEG', margin, yPos, photoWidth, photoHeight); doc.setDrawColor(200); doc.rect(margin, yPos, photoWidth, photoHeight); } catch(e) {} }
          if (p2) { try { doc.addImage(p2, 'JPEG', margin + photoWidth + 6, yPos, photoWidth, photoHeight); doc.setDrawColor(200); doc.rect(margin + photoWidth + 6, yPos, photoWidth, photoHeight); } catch(e) {} }
          yPos += rowHeight;
      }
      yPos += 10;
    } else { yPos += 5; }
  });

  // --- SEÇÃO 4 & 5 ---
  const actionsData = DAMAGE_LOGIC[data.classificacao];
  const parecerText = data.parecerFinal || "";
  
  // Calculate text blocks height to check for page break
  doc.setFontSize(FONT_SIZE_BODY);
  doc.setFont('helvetica', 'normal');
  const splitParecer = doc.splitTextToSize(parecerText, contentWidth);
  const textBlocksHeight = 25 + 10 + (splitParecer.length * LINE_HEIGHT) + 5; 
  const signatureHeight = 35; 
  const preferredSigGap = 35; 
  const minSigGap = 15;       
  const spaceRemainingBlock = pageHeight - bottomMargin - yPos;
  
  let appliedSigGap = preferredSigGap;
  if (spaceRemainingBlock < textBlocksHeight + minSigGap + signatureHeight) {
      doc.addPage();
      yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
  } else {
      if (spaceRemainingBlock < textBlocksHeight + preferredSigGap + signatureHeight) {
          appliedSigGap = Math.max(minSigGap, spaceRemainingBlock - textBlocksHeight - signatureHeight);
      }
      yPos += 5; doc.setDrawColor(200); doc.line(margin, yPos, pageWidth - margin, yPos); yPos += 10;
  }

  // Section 4
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setFillColor(240, 240, 240); doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('4. CLASSIFICAÇÃO FINAL', margin + 2, yPos); yPos += 10;
  
  let h = printKeyValue('CLASSIFICAÇÃO:', data.classificacao.toUpperCase(), margin, yPos, contentWidth); yPos += h + 2;
  h = printKeyValue('NÍVEL DE DESTRUIÇÃO:', actionsData.level.toUpperCase(), margin, yPos, contentWidth); yPos += h + 2;
  h = printKeyValue('PERCENTUAL ESTIMADO:', actionsData.percent, margin, yPos, contentWidth); yPos += h + 8;

  // Section 5
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setFillColor(240, 240, 240); doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('5. PARECER TÉCNICO FINAL', margin + 2, yPos); yPos += 10;
  
  doc.setFontSize(FONT_SIZE_BODY); 
  doc.setFont('helvetica', 'normal');
  // Removed custom LineHeightFactor to match standard spacing
  doc.text(splitParecer, margin, yPos);
  yPos += (splitParecer.length * LINE_HEIGHT); 

  yPos += appliedSigGap;

  // --- SIGNATURE ---
  // Lista de engenheiros que NÃO devem ter a assinatura eletrônica
  const engineersWithoutElectronicSignature = [
    'Alessandra Santana Calegari',
    'Regina De Toni',
    'Carlos Germano Justi',
    'Sandoval Schmitt',
    'Cristian Schwarz',
    'Tatiane Aparecida Mendes da Silva'
  ];

  const shouldShowElectronicSignature = selectedEngineer.institution === 'CEDEC' && !engineersWithoutElectronicSignature.includes(selectedEngineer.name);

  if (shouldShowElectronicSignature) {
      doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
      doc.text('Assinado Eletronicamente', pageWidth / 2, yPos - 5, { align: 'center' });
      doc.setTextColor(0, 0, 0); 
  }
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(selectedEngineer.name.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
  yPos += 5; doc.setFontSize(10); doc.text('Engenheiro(a) Civil', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5; doc.text(`CREA-${selectedEngineer.state || 'PR'} ${selectedEngineer.crea}`, pageWidth / 2, yPos, { align: 'center' });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(doc, i, totalPages, pageWidth, pageHeight);
  }

  if (mode === 'save') {
    const cleanText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const formatDateForFilename = (dateStr: string) => { const p = dateStr.split('-'); return p.length === 3 ? `${p[2]}${p[1]}${p[0]}` : dateStr.replace(/[^0-9]/g, ''); };
    // Filename Format: [Protocolo]_[Municipio]_[Requerente]_[Data].pdf
    const protocoloClean = cleanText(data.protocolo || 'SEM-PROTOCOLO');
    doc.save(`${protocoloClean}_${cleanText(data.municipio)}_${cleanText(data.requerente || 'NAO-INFORMADO')}_${formatDateForFilename(data.data)}.pdf`);
  } else {
    return URL.createObjectURL(doc.output('blob'));
  }
};