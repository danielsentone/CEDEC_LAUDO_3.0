import jsPDF from 'jspdf';
import { LaudoForm, Engineer, DamageEntry, BuildingTypology, ZoneType } from '../types';
import { DAMAGE_LOGIC } from '../constants';

const drawHeader = (doc: jsPDF, pageWidth: number, margin: number, logoLeft?: string, logoRight?: string): number => {
  const headerStart = 10;
  const logoBoxSize = 25; // Max box size for logos to ensure equivalence
  
  // --- Center Text ---
  // We draw text first or concurrently. The logos sit on sides.
  const centerX = pageWidth / 2;
  let textY = headerStart + 5;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADO DO PARANÁ', centerX, textY, { align: 'center' });
  
  textY += 5;
  doc.text('COORDENADORIA ESTADUAL DA DEFESA CIVIL', centerX, textY, { align: 'center' });
  
  textY += 5;
  doc.text('FUNDO ESTADUAL PARA CALAMIDADES PÚBLICAS', centerX, textY, { align: 'center' });

  // --- Right Logo (Defesa Civil) ---
  const logoRightX = pageWidth - margin - logoBoxSize;
  const logoY = headerStart;

  if (logoRight) {
     try {
        const props = doc.getImageProperties(logoRight);
        const ratio = props.width / props.height;
        let w = logoBoxSize;
        let h = logoBoxSize;
        
        // Calculate dimensions to contain within box (preserve aspect ratio)
        if (ratio > 1) {
            h = w / ratio;
        } else {
            w = h * ratio;
        }
        
        // Center vertically and horizontally in the box
        const x = logoRightX + (logoBoxSize - w) / 2;
        const y = logoY + (logoBoxSize - h) / 2;

        doc.addImage(logoRight, 'PNG', x, y, w, h);
     } catch(e) { console.warn("Error adding right logo", e); }
  } else {
      // Fallback: Vector Simulation of Defesa Civil PR Logo
      // Orange Box
      doc.setFillColor(234, 88, 12); // Orange
      doc.rect(logoRightX, logoY, logoBoxSize, logoBoxSize, 'F');
      
      // White Text inside Logo
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(5); 
      doc.setFont('helvetica', 'bold');
      doc.text('DEFESA CIVIL', logoRightX + (logoBoxSize/2), logoY + 4, { align: 'center' });
      doc.text('PARANÁ', logoRightX + (logoBoxSize/2), logoY + logoBoxSize - 3, { align: 'center' });
      
      // Triangle Symbol (Simplified)
      const centerXIcon = logoRightX + (logoBoxSize/2);
      const centerYIcon = logoY + 10;
      
      doc.setFillColor(255, 255, 255);
      doc.triangle(
          centerXIcon, centerYIcon - 3, 
          centerXIcon - 6, centerYIcon + 6, 
          centerXIcon + 6, centerYIcon + 6, 
          'F'
      );
      doc.setFillColor(30, 58, 138); // Blue
      doc.triangle(
          centerXIcon, centerYIcon, 
          centerXIcon - 3, centerYIcon + 4, 
          centerXIcon + 3, centerYIcon + 4, 
          'F'
      );
  }

  // --- Left Logo (Brasão) ---
  const logoLeftX = margin;

  if (logoLeft) {
      try {
        const props = doc.getImageProperties(logoLeft);
        const ratio = props.width / props.height;
        let w = logoBoxSize;
        let h = logoBoxSize;
        
        if (ratio > 1) {
            h = w / ratio;
        } else {
            w = h * ratio;
        }
        
        const x = logoLeftX + (logoBoxSize - w) / 2;
        const y = logoY + (logoBoxSize - h) / 2;

        doc.addImage(logoLeft, 'PNG', x, y, w, h);
      } catch(e) { console.warn("Error adding left logo", e); }
  } else {
      // Fallback: Placeholder Shield
      doc.setDrawColor(0);
      doc.setFillColor(255, 255, 255);
      doc.rect(logoLeftX, logoY, logoBoxSize - 4, logoBoxSize, 'S'); // slightly narrower
      doc.setFontSize(6);
      doc.setTextColor(0);
      doc.text('BRASÃO', logoLeftX + ((logoBoxSize-4)/2), logoY + (logoBoxSize/2), { align: 'center' });
      doc.text('PR', logoLeftX + ((logoBoxSize-4)/2), logoY + (logoBoxSize/2) + 3, { align: 'center' });
  }

  // Reset Font Color
  doc.setTextColor(0, 0, 0);
  return 45; // Start content below header
};

// Function to draw colored vector footer
const drawFooter = (doc: jsPDF, pageNumber: number, totalPages: number, pageWidth: number, pageHeight: number) => {
    const footerHeight = 25;
    const footerY = pageHeight - footerHeight; 
    
    // Colored Bar Dimensions
    const barHeight = 4; // Thickness of the line
    const slantWidth = 6; // Width of the slant gap
    const splitRatio = 0.80; // Split position (80% for blue, rest for green)
    const splitX = pageWidth * splitRatio;
    const gapSize = 1.5;

    // -- Draw Blue Bar (Left) --
    // Shape: Rect from 0 to splitX, slant bottom-left to top-right
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
    // Shape: Starts after gap, goes to end
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
    doc.setTextColor(0, 0, 0); // Black text requested
    doc.setFont('helvetica', 'normal');
    
    let textY = footerY + barHeight + 5;
    const centerX = pageWidth / 2;
    
    // Line 1: Address
    doc.text('Palácio das Araucárias - 1º andar - Setor C | Centro Cívico | Curitiba/PR | CEP 80.530-140', centerX, textY, { align: 'center' });
    textY += 4;
    
    // Line 2: Contacts
    doc.text('E-mail: defesacivil@defesacivil.pr.gov.br | Fone: (41) 3281-2500', centerX, textY, { align: 'center' });
    textY += 4;
    
    // Line 3: Slogan
    doc.setFont('helvetica', 'bold');
    doc.text('“Defesa Civil somos todos nós”', centerX, textY, { align: 'center' });

    // Page number (Small, bottom right, unobtrusive)
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
  const bottomMargin = 25; // Space reserved for automatic footer

  // Initial Header
  let yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);

  // Helper to handle page breaks
  const checkPageBreak = (heightNeeded: number) => {
    if (yPos + heightNeeded > pageHeight - bottomMargin) {
        doc.addPage();
        yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
    }
  };

  // Helper to format values that might be empty
  const formatValue = (value: string | undefined | null): string => {
    if (!value || value.trim() === '') {
        return 'NÃO INFORMADO';
    }
    return value.toUpperCase();
  };

  // --- Title ---
  checkPageBreak(20);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LAUDO DE IMÓVEL AFETADO POR EVENTO CLIMÁTICO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // --- General Info ---
  checkPageBreak(20);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('MUNICÍPIO:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(formatValue(data.municipio), margin + 25, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('DATA:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(data.data).toLocaleDateString('pt-BR'), margin + 15, yPos);

  yPos += 15;
  checkPageBreak(15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('INFORMAÇÕES DO IMÓVEL', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // --- Property Info ---
  doc.setFontSize(11);
  const addField = (label: string, value: string) => {
    checkPageBreak(15); // Check if next field fits
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, yPos);
    const labelWidth = doc.getTextWidth(label);
    doc.setFont('helvetica', 'normal');
    
    // Simple text wrapping for long addresses/descriptions
    const splitText = doc.splitTextToSize(value, contentWidth - labelWidth - 2);
    doc.text(splitText, margin + labelWidth + 2, yPos);
    yPos += (splitText.length * 6) + 2; 
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
  addField('CPF REQUERENTE:', formatValue(data.cpfRequerente));
  
  // Construct address only from parts that exist, or fallback to NOT INFORMED
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

  yPos += 5;

  // --- Map Capture in PDF ---
  checkPageBreak(90);
  
  if (mapImage) {
      // 1. Draw Image
      try {
          // Adjust height based on aspect ratio of the container (approx 2:1 in MapPicker)
          // We use a fixed height for consistency in the report
          const mapHeight = 80;
          doc.addImage(mapImage, 'PNG', margin, yPos, contentWidth, mapHeight);
          
          doc.setDrawColor(0);
          doc.rect(margin, yPos, contentWidth, mapHeight);

          // 2. Draw Vector Pin (Overlay)
          // We assume the map is centered on the location.
          const pinX = margin + (contentWidth / 2);
          const pinY = yPos + (mapHeight / 2);
          
          // Draw a Red Pin
          doc.setFillColor(220, 38, 38); // Red-600
          doc.setDrawColor(185, 28, 28); // Red-700
          
          // Circle head
          doc.circle(pinX, pinY - 5, 3, 'FD');
          
          // Triangle tail
          doc.triangle(
              pinX - 3, pinY - 4,
              pinX + 3, pinY - 4,
              pinX, pinY,
              'FD'
          );
          
          // Small white dot in center
          doc.setFillColor(255, 255, 255);
          doc.circle(pinX, pinY - 5, 1, 'F');
          
          // Reset colors
          doc.setTextColor(0);

      } catch(e) {
          console.error("Failed to embed map image", e);
          // Fallback box
          doc.setDrawColor(0);
          doc.setFillColor(240, 240, 240);
          doc.rect(margin, yPos, contentWidth, 80, 'FD');
          doc.text('[ERRO AO GERAR IMAGEM DO MAPA]', pageWidth / 2, yPos + 40, { align: 'center' });
      }
  } else {
      // Placeholder if capture failed
      doc.setDrawColor(0);
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, contentWidth, 80, 'FD');
      doc.setFontSize(10);
      doc.text('[VISTA DE SATÉLITE - COORDENADAS: ' + coords + ']', pageWidth / 2, yPos + 40, { align: 'center' });
  }

  yPos += 90;

  // --- Damages Header ---
  checkPageBreak(25);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('LEVANTAMENTO DE DANOS', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // --- Damages List ---
  data.danos.forEach((dano) => {
    checkPageBreak(20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    
    const title = `${dano.type.toUpperCase()}: `;
    const desc = dano.description;
    
    doc.text(title, margin, yPos);
    const titleWidth = doc.getTextWidth(title);
    doc.setFont('helvetica', 'normal');
    
    const splitDesc = doc.splitTextToSize(desc, contentWidth - titleWidth);
    doc.text(splitDesc, margin + titleWidth, yPos);
    
    yPos += (splitDesc.length * 6) + 5;

    // Photos
    if (dano.photos.length > 0) {
      const photoWidth = (contentWidth - 10) / 2;
      const photoHeight = 60;
      
      // Calculate needed space: 1 row of photos = height + padding
      const rows = Math.ceil(dano.photos.length / 2);
      const spaceNeeded = rows * (photoHeight + 5);

      if (yPos + spaceNeeded > pageHeight - bottomMargin) {
           doc.addPage();
           yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
      }

      let xOffset = margin;
      dano.photos.forEach((photo, idx) => {
        if (idx > 3) return; // Limit for PDF safety
        
        // Wrap to next line if idx is even and not 0 (grid of 2)
        if (idx > 0 && idx % 2 === 0) {
             xOffset = margin;
             yPos += photoHeight + 5;
             checkPageBreak(photoHeight);
        }

        try {
            doc.addImage(photo, 'JPEG', xOffset, yPos, photoWidth, photoHeight);
            doc.setDrawColor(0);
            doc.rect(xOffset, yPos, photoWidth, photoHeight); 
        } catch (e) {
            console.error("Error adding image", e);
        }
        xOffset += photoWidth + 10;
      });
      yPos += photoHeight + 10;
    }
  });
  
  // --- Actions/Classification ---
  checkPageBreak(40);
  yPos += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AÇÕES DO TORNADO / DESASTRE', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(11);
  const actionsData = DAMAGE_LOGIC[data.classificacao];

  addField('CLASSIFICAÇÃO:', data.classificacao.toUpperCase());
  addField('NÍVEL DE DESTRUIÇÃO:', actionsData.level.toUpperCase());
  addField('PERCENTUAL CONSIDERADO DE DESTRUIÇÃO:', actionsData.percent);

  yPos += 5;

  // --- Parecer Técnico Final ---
  if (data.parecerFinal) {
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PARECER TÉCNICO FINAL', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      
      const splitParecer = doc.splitTextToSize(data.parecerFinal, contentWidth);
      
      // Check if text block fits, if not page break and print rest
      if (yPos + (splitParecer.length * 6) > pageHeight - bottomMargin) {
          doc.addPage();
          yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
      }
      
      doc.text(splitParecer, margin, yPos);
      yPos += (splitParecer.length * 6) + 5;
  }


  // --- Signature ---
  checkPageBreak(40);
  yPos += 30;
  
  // Electronic Signature for CEDEC
  if (selectedEngineer.institution === 'CEDEC') {
      doc.setTextColor(100, 100, 100); // Gray
      doc.setFont('helvetica', 'italic');
      doc.text('Assinado Eletronicamente', pageWidth / 2, yPos - 5, { align: 'center' });
      doc.setTextColor(0, 0, 0); // Reset to Black
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(selectedEngineer.name.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.text('Engenheiro(a) Civil', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  const creaText = `CREA-${selectedEngineer.state || 'PR'} ${selectedEngineer.crea}`;
  doc.text(creaText, pageWidth / 2, yPos, { align: 'center' });

  // --- Automatic Footer on All Pages ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(doc, i, totalPages, pageWidth, pageHeight);
  }

  // Output
  if (mode === 'save') {
    doc.save(`Laudo_${data.municipio}_${data.id_laudo || 'novo'}.pdf`);
  } else {
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  }
};