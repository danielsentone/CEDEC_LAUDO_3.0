import jsPDF from 'jspdf';
import { LaudoForm, Engineer, DamageEntry, BuildingTypology, ZoneType } from '../types';
import { DAMAGE_LOGIC } from '../constants';

const drawHeader = (doc: jsPDF, pageWidth: number, margin: number, logoLeft?: string, logoRight?: string): number => {
  // Ajustado para 15 para dar espaço ao topo do Brasão
  const headerStart = 15;
  
  // Define distinct box sizes to balance visual weight
  const logoBoxSizeRight = 24; 
  const logoBoxSizeLeft = 28; 

  // Texto: Linhas em Y = 15, 20, 25, 30.
  // LogoBaseline em 32 alinha visualmente a base da imagem com a base da última linha de texto.
  const logoBaseline = headerStart + 17; 
  
  // --- Center Text ---
  // Calculates the visual center between the two logos to ensure equal spacing
  const contentStartX = margin + logoBoxSizeLeft;
  const contentEndX = pageWidth - margin - logoBoxSizeRight;
  const centerX = (contentStartX + contentEndX) / 2;

  let textY = headerStart;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  
  // Primeira linha em Negrito (ESTADO DO PARANÁ)
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DO PARANÁ', centerX, textY, { align: 'center' });
  
  // Demais linhas em fonte Normal
  doc.setFont('helvetica', 'normal');

  textY += 5;
  doc.text('COORDENADORIA ESTADUAL DA DEFESA CIVIL', centerX, textY, { align: 'center' });
  
  textY += 5;
  doc.text('DIVISÃO DE CONTRATOS, CONVÊNIOS E FUNDOS', centerX, textY, { align: 'center' });

  textY += 5;
  doc.text('FUNDO ESTADUAL PARA CALAMIDADES PÚBLICAS', centerX, textY, { align: 'center' });

  // --- Right Logo (Defesa Civil) ---
  const logoRightX = pageWidth - margin - logoBoxSizeRight;

  if (logoRight) {
     try {
        const props = doc.getImageProperties(logoRight);
        const ratio = props.width / props.height;
        let w = logoBoxSizeRight;
        let h = logoBoxSizeRight;
        
        if (ratio > 1) {
            h = w / ratio;
        } else {
            w = h * ratio;
        }
        
        const x = logoRightX + (logoBoxSizeRight - w) / 2;
        // Align by bottom: Baseline minus height
        const y = logoBaseline - h;

        doc.addImage(logoRight, 'PNG', x, y, w, h);
     } catch(e) { console.warn("Error adding right logo", e); }
  } else {
      // Fallback
      doc.setFillColor(234, 88, 12); 
      // Align fallback box to bottom as well
      doc.rect(logoRightX, logoBaseline - logoBoxSizeRight, logoBoxSizeRight, logoBoxSizeRight, 'F');
  }

  // --- Left Logo (Brasão) ---
  const logoLeftX = margin;

  if (logoLeft) {
      try {
        const props = doc.getImageProperties(logoLeft);
        const ratio = props.width / props.height;
        let w = logoBoxSizeLeft;
        let h = logoBoxSizeLeft;
        
        if (ratio > 1) {
            h = w / ratio;
        } else {
            w = h * ratio;
        }
        
        const x = logoLeftX + (logoBoxSizeLeft - w) / 2;
        // Align by bottom: Baseline minus height
        const y = logoBaseline - h;

        doc.addImage(logoLeft, 'PNG', x, y, w, h);
      } catch(e) { console.warn("Error adding left logo", e); }
  }

  doc.setTextColor(0, 0, 0);
  
  // Retorna Y=50 para garantir que o título do laudo não sobreponha as logos ou texto
  return 50; 
};

// Function to draw colored vector footer
const drawFooter = (doc: jsPDF, pageNumber: number, totalPages: number, pageWidth: number, pageHeight: number) => {
    const footerHeight = 25;
    const footerY = pageHeight - footerHeight; 
    
    // Colored Bar Dimensions
    const barHeight = 4; 
    const slantWidth = 6; 
    const splitRatio = 0.80; 
    const splitX = pageWidth * splitRatio;
    const gapSize = 1.5;

    // -- Draw Blue Bar (Left) --
    doc.setFillColor(0, 91, 159); // Standard Blue #005b9f
    doc.path([
        { op: 'm', c: [0, footerY] },
        { op: 'l', c: [splitX, footerY] },
        { op: 'l', c: [splitX - slantWidth, footerY + barHeight] },
        { op: 'l', c: [0, footerY + barHeight] },
        { op: 'h' }
    ]);
    doc.fill();
    
    // -- Draw Green Bar (Right) --
    const greenStartX = splitX + gapSize;
    
    doc.setFillColor(0, 157, 87); // Flag Green
    doc.path([
        { op: 'm', c: [greenStartX, footerY] },
        { op: 'l', c: [pageWidth, footerY] },
        { op: 'l', c: [pageWidth, footerY + barHeight] },
        { op: 'l', c: [greenStartX - slantWidth, footerY + barHeight] },
        { op: 'h' }
    ]);
    doc.fill();

    // -- Footer Text --
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

    // Page number
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(`${pageNumber}/${totalPages}`, pageWidth - 5, pageHeight - 3, { align: 'right' });
};


export const generateLaudoPDF = async (
  data: LaudoForm, 
  selectedEngineer: Engineer,
  mode: 'save' | 'preview' = 'save',
  mapImage?: string
): Promise<string | void> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  const bottomMargin = 30; // Increased reserved space

  // Initial Header
  let yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);

  // Helper to handle page breaks
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

  // ==========================================
  // PÁGINA 1: IDENTIFICAÇÃO, DADOS E MAPA
  // ==========================================

  // --- Title ---
  // Ensure title starts with a safe gap from the header return
  yPos += 5; 
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LAUDO DE IMÓVEL AFETADO POR EVENTO CLIMÁTICO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // --- 1. Localização e Data ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  // Creating a visual section header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('1. LOCALIZAÇÃO E DATA', margin + 2, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.text('MUNICÍPIO:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(formatValue(data.municipio), margin + 25, yPos);
  
  // Align Data to the right roughly
  const dateLabelX = margin + 100;
  doc.setFont('helvetica', 'bold');
  doc.text('DATA DA VISTORIA:', dateLabelX, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(data.data).toLocaleDateString('pt-BR'), dateLabelX + 40, yPos);

  yPos += 12;

  // --- 3. Dados do Imóvel ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('3. DADOS DO IMÓVEL', margin + 2, yPos);
  yPos += 8;

  doc.setFontSize(10);
  const addField = (label: string, value: string, sameLine = false, xOffset = 0) => {
    doc.setFont('helvetica', 'bold');
    const drawX = margin + xOffset;
    doc.text(label, drawX, yPos);
    const labelWidth = doc.getTextWidth(label);
    doc.setFont('helvetica', 'normal');
    
    // Simple text wrapping
    const maxWidth = sameLine ? (contentWidth/2 - labelWidth) : (contentWidth - labelWidth - 2);
    const splitText = doc.splitTextToSize(value, maxWidth);
    doc.text(splitText, drawX + labelWidth + 2, yPos);
    
    if (!sameLine) {
        yPos += (splitText.length * 5) + 2; 
    }
    return splitText.length; // Return lines used
  };

  addField('ZONA:', formatValue(data.zona));

  if (data.zona === ZoneType.URBANO) {
      addField('INDICAÇÃO FISCAL:', formatValue(data.indicacaoFiscal));
      addField('INSCRIÇÃO MUNICIPAL:', formatValue(data.inscricaoImobiliaria));
      addField('MATRÍCULA:', formatValue(data.matricula));
  } else {
      addField('NIRF / CIB:', formatValue(data.nirfCib));
      addField('INCRA:', formatValue(data.incra));
  }

  addField('PROPRIETÁRIO:', formatValue(data.proprietario));
  addField('REQUERENTE:', formatValue(data.requerente));
  addField('CPF:', formatValue(data.cpfRequerente));
  
  let fullAddress = '';
  if (data.endereco || data.bairro || data.cep) {
      const parts = [];
      if (data.endereco) parts.push(data.endereco);
      if (data.bairro) parts.push(data.bairro);
      if (data.cep) parts.push(data.cep);
      fullAddress = parts.join(', ');
  }
  
  addField('ENDEREÇO:', formatValue(fullAddress));
  
  const coords = `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`;
  addField('COORDENADAS:', coords);

  const tipologiaText = data.tipologia === BuildingTypology.OUTRO ? data.tipologiaOutro : data.tipologia;
  addField('TIPOLOGIA:', formatValue(tipologiaText));

  yPos += 2;

  // --- Map Capture ---
  // Ensure map fits on page 1, otherwise it will just cut off (but layout is designed to fit)
  if (mapImage) {
      try {
          const mapHeight = 85;
          doc.addImage(mapImage, 'PNG', margin, yPos, contentWidth, mapHeight);
          doc.setDrawColor(0);
          doc.rect(margin, yPos, contentWidth, mapHeight);

          // Vector Pin
          const pinX = margin + (contentWidth / 2);
          const pinY = yPos + (mapHeight / 2);
          
          doc.setFillColor(220, 38, 38); 
          doc.setDrawColor(185, 28, 28); 
          doc.circle(pinX, pinY - 5, 3, 'FD');
          doc.triangle(pinX - 3, pinY - 4, pinX + 3, pinY - 4, pinX, pinY, 'FD');
          doc.setFillColor(255, 255, 255);
          doc.circle(pinX, pinY - 5, 1, 'F');
          doc.setTextColor(0);

      } catch(e) {
          console.error("Failed to embed map", e);
      }
  }

  // ==========================================
  // PÁGINA 2+: DANOS
  // ==========================================
  doc.addPage();
  yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('4. LEVANTAMENTO DE DANOS', margin + 2, yPos);
  yPos += 10;

  data.danos.forEach((dano) => {
    // Check if title + description fits, otherwise break page
    // Estimating 3 lines for description
    checkPageBreak(30); 

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const title = `${dano.type.toUpperCase()}: `;
    doc.text(title, margin, yPos);
    
    const titleWidth = doc.getTextWidth(title);
    doc.setFont('helvetica', 'normal');
    
    const desc = dano.description || "Sem descrição detalhada.";
    const splitDesc = doc.splitTextToSize(desc, contentWidth - titleWidth);
    doc.text(splitDesc, margin + titleWidth, yPos);
    
    yPos += (splitDesc.length * 5) + 3;

    // Photos Grid
    if (dano.photos.length > 0) {
      const photoWidth = (contentWidth - 6) / 2; // Slight gap
      const photoHeight = 55; // Reduced slightly to fit more
      const rowHeight = photoHeight + 6; // Height + padding

      // Iterate photos in pairs
      for (let i = 0; i < dano.photos.length; i += 2) {
          const p1 = dano.photos[i];
          const p2 = dano.photos[i+1];

          // Check if this row fits
          if (yPos + photoHeight > pageHeight - bottomMargin) {
              doc.addPage();
              yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
          }

          if (p1) {
             try {
                doc.addImage(p1, 'JPEG', margin, yPos, photoWidth, photoHeight);
                doc.setDrawColor(200);
                doc.rect(margin, yPos, photoWidth, photoHeight);
             } catch(e) {}
          }

          if (p2) {
             try {
                doc.addImage(p2, 'JPEG', margin + photoWidth + 6, yPos, photoWidth, photoHeight);
                doc.setDrawColor(200);
                doc.rect(margin + photoWidth + 6, yPos, photoWidth, photoHeight);
             } catch(e) {}
          }

          yPos += rowHeight;
      }
      yPos += 2; // Extra small spacing after damage block
    } else {
        yPos += 5; // Spacing if no photos
    }
  });

  // ==========================================
  // BLOCO FINAL: CLASSIFICAÇÃO E PARECER (Agrupados)
  // ==========================================
  
  // 1. Calculate height of Information Block (Sections 5 & 6)
  const actionsData = DAMAGE_LOGIC[data.classificacao];
  doc.setFontSize(10);
  const parecerText = data.parecerFinal || "";
  const splitParecer = doc.splitTextToSize(parecerText, contentWidth);
  
  // Section 5 is approx 35mm
  // Section 6 header is 10mm
  // Section 6 text is lines * 5
  // Extra padding 15mm
  const infoBlockHeight = 35 + 10 + (splitParecer.length * 5) + 5; 

  // If Info block doesn't fit, break page
  if (yPos + infoBlockHeight > pageHeight - bottomMargin) {
      doc.addPage();
      yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
  } else {
      yPos += 5; // Separator
      // Draw a line separator if staying on same page
      doc.setDrawColor(200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;
  }

  // --- 5. Classificação ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('5. CLASSIFICAÇÃO FINAL', margin + 2, yPos);
  yPos += 10;

  doc.setFontSize(10);
  addField('CLASSIFICAÇÃO:', data.classificacao.toUpperCase());
  addField('NÍVEL DE DESTRUIÇÃO:', actionsData.level.toUpperCase());
  addField('PERCENTUAL ESTIMADO:', actionsData.percent);
  
  yPos += 8;

  // --- 6. Parecer Técnico ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('6. PARECER TÉCNICO FINAL', margin + 2, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(splitParecer, margin, yPos);
  yPos += (splitParecer.length * 5); // Just text height

  // ==========================================
  // ASSINATURA (Com lógica de espaçamento)
  // ==========================================

  const signatureHeight = 35; 
  const signatureGap = 35; // Large gap requested for manual signature

  // Check if we can fit the signature with the LARGE gap on the current page
  if (yPos + signatureGap + signatureHeight > pageHeight - bottomMargin) {
      // If it doesn't fit with the large gap, move to new page
      // On the new page, we treat it as "positioned alone", so standard spacing applies
      doc.addPage();
      yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
      yPos += 10; // Standard small top margin
  } else {
      // Fits on same page, apply the large gap
      yPos += signatureGap;
  }

  // --- Identificação do Engenheiro (Signature) ---
  // Electronic Signature indicator
  if (selectedEngineer.institution === 'CEDEC') {
      doc.setTextColor(100, 100, 100); 
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('Assinado Eletronicamente', pageWidth / 2, yPos - 5, { align: 'center' });
      doc.setTextColor(0, 0, 0); 
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(selectedEngineer.name.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.setFontSize(10);
  doc.text('Engenheiro(a) Civil', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  const creaText = `CREA-${selectedEngineer.state || 'PR'} ${selectedEngineer.crea}`;
  doc.text(creaText, pageWidth / 2, yPos, { align: 'center' });


  // --- Footer Loop ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(doc, i, totalPages, pageWidth, pageHeight);
  }

  // Output
  if (mode === 'save') {
    // Filename Logic: MUNICIPIO_REQUERENTE_DATA.pdf
    const cleanText = (text: string) => {
        return text
            .normalize('NFD') // Decompose combined characters (accents)
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphen
            .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
    };

    const formatDateForFilename = (dateStr: string) => {
        // Expects YYYY-MM-DD
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}${parts[1]}${parts[0]}`; // DDMMYYYY
        }
        return dateStr.replace(/[^0-9]/g, '');
    };

    const fileNameMunicipio = cleanText(data.municipio);
    const fileNameRequerente = cleanText(data.requerente || 'NAO-INFORMADO');
    const fileNameData = formatDateForFilename(data.data);

    const finalFileName = `${fileNameMunicipio}_${fileNameRequerente}_${fileNameData}.pdf`;

    doc.save(finalFileName);
  } else {
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  }
};