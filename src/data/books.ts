export type Book = {
  slug: string;
  title: string;
  author: string;
  description: string;
  category: string;
  level: 'Básico' | 'Intermedio' | 'Avanzado';
  type: 'Libro' | 'Manual' | 'Guía' | 'Catálogo' | 'Norma';
  language: string;
  pages: number;
  publicationYear: number;
  fileSize: string;
  downloads: number;
  tags: string[];
  badge?: 'Nuevo' | 'Popular' | 'Recomendado';
  accent: string;
  topics: string[];
  pdfUrl: string;
};

const samplePdf = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

export const books: Book[] = [
  { slug: 'variadores-de-frecuencia', title: 'Fundamentos de Variadores de Frecuencia', author: 'Equipo editorial InduTech', description: 'Guía introductoria sobre control de velocidad, parámetros esenciales y puesta en marcha segura de variadores.', category: 'Variadores de Frecuencia', level: 'Básico', type: 'Guía', language: 'Español', pages: 86, publicationYear: 2026, fileSize: '4.2 MB', downloads: 2840, tags: ['VFD', 'motores', 'control'], badge: 'Popular', accent: '#16a34a', topics: ['Principio de operación', 'Parámetros básicos', 'Rampas y protecciones', 'Diagnóstico inicial'], pdfUrl: samplePdf },
  { slug: 'plc-siemens-s7-1200', title: 'PLC Siemens S7-1200: primeros proyectos', author: 'Laboratorio InduTech', description: 'Manual práctico para estructurar programas, conectar entradas y salidas y desarrollar tu primer proyecto de automatización.', category: 'PLC', level: 'Intermedio', type: 'Manual', language: 'Español', pages: 142, publicationYear: 2026, fileSize: '7.8 MB', downloads: 1930, tags: ['Siemens', 'TIA Portal', 'PLC'], badge: 'Recomendado', accent: '#0f766e', topics: ['Arquitectura del PLC', 'Ladder y bloques', 'HMI básico', 'Pruebas y puesta en marcha'], pdfUrl: samplePdf },
  { slug: 'motores-electricos-industriales', title: 'Motores Eléctricos Industriales', author: 'Equipo editorial InduTech', description: 'Conceptos de selección, arranque, mantenimiento y diagnóstico de motores eléctricos en aplicaciones industriales.', category: 'Motores Eléctricos', level: 'Básico', type: 'Libro', language: 'Español', pages: 118, publicationYear: 2025, fileSize: '6.1 MB', downloads: 1604, tags: ['motores', 'mantenimiento', 'arranque'], accent: '#334155', topics: ['Tipos de motor', 'Arranque directo', 'Mantenimiento preventivo', 'Lectura de placa'], pdfUrl: samplePdf },
  { slug: 'instalaciones-electricas-industriales', title: 'Instalaciones Eléctricas Industriales', author: 'Colección Técnica InduTech', description: 'Criterios de diseño para tableros, canalizaciones, protecciones y distribución de energía en planta.', category: 'Electricidad Industrial', level: 'Intermedio', type: 'Libro', language: 'Español', pages: 176, publicationYear: 2025, fileSize: '9.4 MB', downloads: 1217, tags: ['tableros', 'protecciones', 'diseño'], badge: 'Popular', accent: '#a16207', topics: ['Diagramas unifilares', 'Protecciones', 'Conductores', 'Tableros de control'], pdfUrl: samplePdf },
  { slug: 'automatizacion-industrial-practica', title: 'Automatización Industrial Práctica', author: 'Equipo editorial InduTech', description: 'Recorrido por sensores, actuadores, lógica de control y visualización para automatizar procesos.', category: 'Automatización', level: 'Intermedio', type: 'Guía', language: 'Español', pages: 104, publicationYear: 2026, fileSize: '5.9 MB', downloads: 960, tags: ['SCADA', 'sensores', 'procesos'], badge: 'Nuevo', accent: '#0891b2', topics: ['Arquitectura de control', 'Sensores y actuadores', 'Secuencias', 'Supervisión'], pdfUrl: samplePdf },
  { slug: 'instrumentacion-de-procesos', title: 'Instrumentación de Procesos', author: 'Laboratorio InduTech', description: 'Manual de referencia para señales industriales, transmisores, calibración y lazos de control.', category: 'Instrumentación', level: 'Avanzado', type: 'Manual', language: 'Español', pages: 154, publicationYear: 2025, fileSize: '8.2 MB', downloads: 742, tags: ['4-20 mA', 'calibración', 'transmisores'], accent: '#7c3aed', topics: ['Señales industriales', 'Calibración', 'P&ID', 'Lazos de control'], pdfUrl: samplePdf },
  { slug: 'seguridad-electrica-en-planta', title: 'Seguridad Eléctrica en Planta', author: 'Colección Técnica InduTech', description: 'Buenas prácticas para identificar riesgos eléctricos, planificar trabajos y proteger a las personas.', category: 'Seguridad Eléctrica', level: 'Básico', type: 'Guía', language: 'Español', pages: 72, publicationYear: 2026, fileSize: '3.6 MB', downloads: 1321, tags: ['LOTO', 'riesgo', 'EPP'], badge: 'Nuevo', accent: '#dc2626', topics: ['Evaluación de riesgos', 'Bloqueo y etiquetado', 'EPP', 'Procedimientos seguros'], pdfUrl: samplePdf },
  { slug: 'electronica-industrial-de-potencia', title: 'Electrónica Industrial de Potencia', author: 'Equipo editorial InduTech', description: 'Bases de semiconductores, rectificación, conmutación y diagnóstico de circuitos de potencia.', category: 'Electrónica', level: 'Avanzado', type: 'Libro', language: 'Español', pages: 198, publicationYear: 2025, fileSize: '10.7 MB', downloads: 681, tags: ['IGBT', 'rectificadores', 'potencia'], accent: '#4f46e5', topics: ['Semiconductores', 'Rectificación', 'Inversores', 'Diagnóstico'], pdfUrl: samplePdf },
];

export const categories = ['Todos', 'Electricidad Industrial', 'Automatización', 'PLC', 'Variadores de Frecuencia', 'Motores Eléctricos', 'Instrumentación', 'Electrónica', 'Seguridad Eléctrica', 'Manuales Técnicos'];
