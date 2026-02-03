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
  
  const FONT_SIZE_BODY = 10;
  const LINE_HEIGHT = 5;

  let yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);

  const formatValue = (value: string | undefined | null): string => {
    if (!value || value.trim() === '') return 'NÃO INFORMADO';
    return value.toUpperCase();
  };

  const printKeyValue = (label: string, value: string, xPos: number, currentY: number, maxWidth: number): number => {
    doc.setFontSize(FONT_SIZE_BODY);
    doc.setFont('helvetica', 'bold');
    doc.text(label, xPos, currentY);
    const labelWidth = doc.getTextWidth(label);
    doc.setFont('helvetica', 'normal');
    const valueX = xPos + labelWidth + 2;
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

  // Fix: Manual date split to avoid timezone shifts and parsing errors
  const dateParts = data.data.split('-');
  const dateValue = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : data.data;

  printKeyValue('MUNICÍPIO:', formatValue(data.municipio), margin, yPos, 95);
  printKeyValue('DATA DA VISTORIA:', dateValue, margin + 100, yPos, contentWidth - 100);
  yPos += LINE_HEIGHT + 2; 
  const hProto = printKeyValue('PROTOCOLO:', formatValue(data.protocolo), margin, yPos, contentWidth);
  yPos += hProto + 6;

  // --- SEÇÃO 2 ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('2. DADOS DO IMÓVEL', margin + 2, yPos);
  yPos += 8;

  const addFieldStack = (label: string, value: string) => {
    const height = printKeyValue(label, value, margin, yPos, contentWidth);
    yPos += height + 1.5;
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
  
  let fullAddressParts = [];
  if (data.endereco) fullAddressParts.push(data.endereco);
  if (data.bairro) fullAddressParts.push(data.bairro);
  if (data.cep) fullAddressParts.push(data.cep);
  addFieldStack('ENDEREÇO:', formatValue(fullAddressParts.join(', ')));
  
  if (showPin) {
    addFieldStack('COORDENADAS:', `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`);
  }
  addFieldStack('TIPOLOGIA:', formatValue(data.tipologia === BuildingTypology.OUTRO ? data.tipologiaOutro : data.tipologia));

  yPos += 2; 

  if (mapImage) {
      try {
          const props = doc.getImageProperties(mapImage);
          const mapRatio = props.width / props.height;
          
          const availableHeight = (pageHeight - bottomMargin) - yPos - 10;
          let targetWidth = contentWidth;
          let targetHeight = targetWidth / mapRatio;

          if (targetHeight > availableHeight) {
              targetHeight = availableHeight;
              targetWidth = targetHeight * mapRatio;
          }

          const mapX = margin + (contentWidth - targetWidth) / 2;
          
          yPos += 5;
          doc.addImage(mapImage, 'PNG', mapX, yPos, targetWidth, targetHeight);
          
          // Moldura
          doc.setDrawColor(0);
          doc.setLineWidth(0.5); 
          doc.rect(mapX, yPos, targetWidth, targetHeight, 'S');
          
          yPos += targetHeight + 5;
      } catch(e) { console.error("Erro ao inserir mapa no PDF", e); }
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
    if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
    }
    
    const title = `3.${index + 1}. ${dano.type.toUpperCase()}:`;
    const desc = dano.description || "Sem descrição detalhada.";
    const height = printKeyValue(title, desc, margin, yPos, contentWidth);
    yPos += height + 4;

    if (dano.photos.length > 0) {
      const photoWidth = (contentWidth - 6) / 2;
      const photoHeight = 55;
      for (let i = 0; i < dano.photos.length; i += 2) {
          const p1 = dano.photos[i];
          const p2 = dano.photos[i+1];
          if (yPos + photoHeight > pageHeight - bottomMargin) {
              doc.addPage();
              yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
          }
          if (p1) { try { doc.addImage(p1, 'JPEG', margin, yPos, photoWidth, photoHeight); doc.setDrawColor(200); doc.rect(margin, yPos, photoWidth, photoHeight); } catch(e) {} }
          if (p2) { try { doc.addImage(p2, 'JPEG', margin + photoWidth + 6, yPos, photoWidth, photoHeight); doc.setDrawColor(200); doc.rect(margin + photoWidth + 6, yPos, photoWidth, photoHeight); } catch(e) {} }
          yPos += photoHeight + 6;
      }
      yPos += 4;
    }
  });

  const actionsData = DAMAGE_LOGIC[data.classificacao];
  const parecerText = data.parecerFinal || "";
  doc.setFontSize(FONT_SIZE_BODY);
  const splitParecer = doc.splitTextToSize(parecerText, contentWidth);
  const PARECER_LINE_HEIGHT_MM = 7; 

  if (yPos + (splitParecer.length * PARECER_LINE_HEIGHT_MM) + 60 > pageHeight - bottomMargin) {
      doc.addPage();
      yPos = drawHeader(doc, pageWidth, margin, data.logoEsquerda, data.logoDireita);
  }

  yPos += 5;
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setFillColor(240, 240, 240); doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('4. CLASSIFICAÇÃO FINAL', margin + 2, yPos); yPos += 10;
  
  let h = printKeyValue('CLASSIFICAÇÃO:', data.classificacao.toUpperCase(), margin, yPos, contentWidth); yPos += h + 2;
  h = printKeyValue('NÍVEL DE DESTRUIÇÃO:', actionsData.level.toUpperCase(), margin, yPos, contentWidth); yPos += h + 2;
  h = printKeyValue('PERCENTUAL ESTIMADO:', actionsData.percent, margin, yPos, contentWidth); yPos += h + 8;

  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setFillColor(240, 240, 240); doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
  doc.text('5. PARECER TÉCNICO FINAL', margin + 2, yPos); yPos += 10;
  
  doc.setFontSize(FONT_SIZE_BODY); doc.setFont('helvetica', 'normal');
  doc.setLineHeightFactor(2.0);
  doc.text(splitParecer, margin, yPos);
  yPos += (splitParecer.length * PARECER_LINE_HEIGHT_MM) + 25; 
  doc.setLineHeightFactor(1.15);

  const engineersWithoutElectronicSignature = ['Alessandra Santana Calegari', 'Regina De Toni', 'Carlos Germano Justi', 'Sandoval Schmitt', 'Cristian Schwarz', 'Tatiane Aparecida Mendes da Silva'];
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
    doc.save(`${cleanText(data.protocolo || 'SEM-PROTOCOLO')}_${cleanText(data.municipio)}_${cleanText(data.requerente || 'NAO-INFORMADO')}_${formatDateForFilename(data.data)}.pdf`);
  } else {
    return URL.createObjectURL(doc.output('blob'));
  }
};