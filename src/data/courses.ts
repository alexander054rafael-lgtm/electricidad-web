export const courseCategories = [
  'Todas',
  'Electricidad Industrial',
  'Automatización',
  'PLC',
  'Variadores de Frecuencia',
  'Motores Eléctricos',
  'Instrumentación',
  'Electrónica Industrial',
  'Seguridad Eléctrica',
] as const;

export type CourseCategory = Exclude<(typeof courseCategories)[number], 'Todas'>;
export type CourseLevel = 'Básico' | 'Intermedio' | 'Avanzado';
export type CourseBadge = 'Gratuito' | 'Nuevo' | 'Recomendado' | 'Avanzado';

export interface CourseModule {
  title: string;
  description: string;
  lessons: string[];
  moduleBookIds?: string[];
}

export interface Course {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  category: CourseCategory;
  level: CourseLevel;
  duration: string;
  durationHours: number;
  instructor: string;
  image: string;
  accent: string;
  badge: CourseBadge;
  featured: boolean;
  isNew: boolean;
  isFree: boolean;
  popularity: number;
  publishedAt: string;
  requirements: string[];
  objectives: string[];
  audience: string[];
  resources: string[];
  courseBookIds: string[];
  relatedCourseSlugs: string[];
  modules: CourseModule[];
}

const courseImage = '/images/courses/variadores-de-frecuencia.svg';

export const courses: Course[] = [
  {
    slug: 'variadores-de-frecuencia-desde-cero',
    title: 'Variadores de Frecuencia desde Cero',
    shortDescription: 'Aprende a seleccionar, instalar, programar y diagnosticar variadores aplicados a motores industriales.',
    description: 'Un programa práctico y progresivo para comprender el control de motores con variadores de frecuencia. Aprenderás desde los fundamentos eléctricos hasta la puesta en marcha, la programación de funciones y el diagnóstico de fallas en aplicaciones industriales reales.',
    category: 'Variadores de Frecuencia',
    level: 'Básico',
    duration: '24 horas',
    durationHours: 24,
    instructor: 'Ing. Ana Rodríguez',
    image: courseImage,
    accent: '#15803d',
    badge: 'Recomendado',
    featured: true,
    isNew: false,
    isFree: false,
    popularity: 98,
    publishedAt: '2026-02-12',
    requirements: ['Conocimientos básicos de electricidad', 'Acceso a un computador', 'Interés por el control de motores industriales'],
    objectives: ['Interpretar los datos eléctricos de un motor', 'Seleccionar y conectar un variador correctamente', 'Configurar parámetros de operación y protección', 'Diagnosticar alarmas y fallas frecuentes'],
    audience: ['Técnicos electricistas', 'Estudiantes de ingeniería y carreras técnicas', 'Personal de mantenimiento', 'Profesionales de automatización'],
    resources: ['Guía técnica descargable', 'Diagramas de conexión', 'Lista de parámetros esenciales', 'Casos prácticos y proyecto final'],
    courseBookIds: ['variadores-de-frecuencia', 'motores-electricos-industriales', 'seguridad-electrica-en-planta'],
    relatedCourseSlugs: ['motores-electricos', 'automatizacion-industrial', 'plc-siemens-desde-cero'],
    modules: [
      { title: 'Fundamentos eléctricos', description: 'Magnitudes y conceptos esenciales para trabajar de forma segura.', lessons: ['Tensión, corriente y potencia', 'Sistemas monofásicos y trifásicos', 'Protecciones y seguridad de trabajo'], moduleBookIds: ['instalaciones-electricas-industriales', 'seguridad-electrica-en-planta'] },
      { title: 'Motores de inducción', description: 'Principio de operación y lectura técnica del motor.', lessons: ['¿Qué es un motor de inducción?', 'Velocidad sincrónica', 'Deslizamiento'], moduleBookIds: ['motores-electricos-industriales', 'variadores-de-frecuencia'] },
      { title: 'Principios del variador', description: 'Arquitectura interna y técnicas de control.', lessons: ['Rectificador, bus DC e inversor', 'Modulación PWM', 'Control escalar y vectorial'], moduleBookIds: ['variadores-de-frecuencia', 'electronica-industrial-de-potencia'] },
      { title: 'Instalación y conexión', description: 'Montaje, cableado de potencia y señales de mando.', lessons: ['Selección y dimensionamiento', 'Cableado de fuerza y control', 'Puesta a tierra y compatibilidad electromagnética'], moduleBookIds: ['instalaciones-electricas-industriales', 'variadores-de-frecuencia'] },
      { title: 'Parámetros básicos', description: 'Configuración inicial para una puesta en marcha confiable.', lessons: ['Datos nominales del motor', 'Rampas, límites y referencias', 'Protecciones térmicas y eléctricas'], moduleBookIds: ['variadores-de-frecuencia', 'motores-electricos-industriales'] },
      { title: 'Programación', description: 'Funciones de control para aplicaciones industriales.', lessons: ['Entradas y salidas digitales', 'Señales analógicas', 'Velocidades múltiples y control PID'], moduleBookIds: ['variadores-de-frecuencia', 'automatizacion-industrial-practica'] },
      { title: 'Fallas y mantenimiento', description: 'Método de diagnóstico y cuidado preventivo.', lessons: ['Lectura del historial de alarmas', 'Fallas de sobrecorriente y sobretensión', 'Plan de inspección preventiva'], moduleBookIds: ['variadores-de-frecuencia', 'motores-electricos-industriales'] },
      { title: 'Proyecto final', description: 'Integración completa de los conocimientos del curso.', lessons: ['Diseño de una aplicación de bombeo', 'Configuración y pruebas', 'Documentación de puesta en marcha'], moduleBookIds: ['variadores-de-frecuencia', 'automatizacion-industrial-practica'] },
    ],
  },
  {
    slug: 'plc-siemens-desde-cero',
    title: 'PLC Siemens desde Cero',
    shortDescription: 'Domina la lógica Ladder, el hardware S7-1200 y la puesta en marcha de automatismos con TIA Portal.',
    description: 'Curso orientado a proyectos para desarrollar soluciones de automatización con PLC Siemens S7-1200, desde la configuración del hardware hasta la programación y las pruebas.',
    category: 'PLC', level: 'Básico', duration: '28 horas', durationHours: 28, instructor: 'Ing. Carlos Mendoza', image: courseImage, accent: '#0f766e', badge: 'Nuevo', featured: true, isNew: true, isFree: false, popularity: 94, publishedAt: '2026-06-18',
    requirements: ['Electricidad básica', 'Computador compatible con TIA Portal'],
    objectives: ['Configurar un PLC S7-1200', 'Programar secuencias en Ladder', 'Diagnosticar señales de campo'],
    audience: ['Técnicos de automatización', 'Estudiantes', 'Personal de mantenimiento'],
    resources: ['Plantillas de proyecto', 'Ejercicios Ladder', 'Mapa de memoria de ejemplo'],
    courseBookIds: ['plc-siemens-s7-1200', 'automatizacion-industrial-practica'],
    relatedCourseSlugs: ['automatizacion-industrial', 'instrumentacion-industrial'],
    modules: [
      { title: 'Arquitectura del PLC', description: 'Hardware, señales y ciclo de scan.', lessons: ['CPU y módulos', 'Entradas y salidas', 'Ciclo de programa'] },
      { title: 'TIA Portal', description: 'Creación y organización del proyecto.', lessons: ['Configuración de dispositivo', 'Tabla de variables', 'Carga y monitoreo'] },
      { title: 'Programación Ladder', description: 'Lógica combinacional y secuencial.', lessons: ['Contactos y bobinas', 'Temporizadores y contadores', 'Secuencias automáticas'] },
      { title: 'Proyecto industrial', description: 'Control integral de una estación.', lessons: ['Diseño funcional', 'Programación', 'Pruebas y diagnóstico'] },
    ],
  },
  {
    slug: 'motores-electricos',
    title: 'Motores Eléctricos',
    shortDescription: 'Selecciona, conecta y mantén motores eléctricos con criterios técnicos aplicables en planta.',
    description: 'Formación esencial para reconocer motores industriales, interpretar su placa, ejecutar conexiones y establecer rutinas de mantenimiento confiables.',
    category: 'Motores Eléctricos', level: 'Básico', duration: '12 horas', durationHours: 12, instructor: 'Ing. Luis Herrera', image: courseImage, accent: '#334155', badge: 'Gratuito', featured: false, isNew: false, isFree: true, popularity: 91, publishedAt: '2025-11-08',
    requirements: ['No se requiere experiencia previa'], objectives: ['Reconocer tipos de motores', 'Interpretar placas', 'Realizar conexiones básicas'], audience: ['Estudiantes', 'Operadores', 'Técnicos junior'], resources: ['Tablas de conexión', 'Fichas de inspección', 'Guía de lectura de placa'], courseBookIds: ['motores-electricos-industriales', 'variadores-de-frecuencia'], relatedCourseSlugs: ['variadores-de-frecuencia-desde-cero', 'seguridad-electrica'],
    modules: [
      { title: 'Principios de máquinas eléctricas', description: 'Bases electromagnéticas del motor.', lessons: ['Campo magnético', 'Tipos de motor', 'Partes principales'] },
      { title: 'Placa y conexiones', description: 'Interpretación y cableado.', lessons: ['Datos nominales', 'Estrella y triángulo', 'Sentido de giro'] },
      { title: 'Arranque y protección', description: 'Métodos de maniobra seguros.', lessons: ['Arranque directo', 'Relé térmico', 'Coordinación básica'] },
      { title: 'Mantenimiento', description: 'Inspección y fallas comunes.', lessons: ['Rutina preventiva', 'Mediciones', 'Diagnóstico inicial'] },
    ],
  },
  {
    slug: 'automatizacion-industrial',
    title: 'Automatización Industrial',
    shortDescription: 'Integra sensores, actuadores y controladores para crear procesos automáticos eficientes.',
    description: 'Una visión completa de la arquitectura de automatización industrial, sus dispositivos y los criterios para diseñar secuencias robustas.',
    category: 'Automatización', level: 'Intermedio', duration: '20 horas', durationHours: 20, instructor: 'Ing. Valeria Torres', image: courseImage, accent: '#0369a1', badge: 'Recomendado', featured: true, isNew: false, isFree: false, popularity: 96, publishedAt: '2026-01-25',
    requirements: ['Electricidad industrial básica', 'Fundamentos de lógica'], objectives: ['Diseñar arquitecturas de control', 'Seleccionar sensores y actuadores', 'Documentar secuencias'], audience: ['Técnicos', 'Ingenieros junior', 'Integradores'], resources: ['Diagramas de proceso', 'Plantillas GRAFCET', 'Casos de estudio'], courseBookIds: ['automatizacion-industrial-practica', 'plc-siemens-s7-1200', 'instrumentacion-de-procesos'], relatedCourseSlugs: ['plc-siemens-desde-cero', 'instrumentacion-industrial'],
    modules: [
      { title: 'Arquitectura de automatización', description: 'Capas y equipos de un sistema.', lessons: ['Pirámide de automatización', 'Controladores', 'Redes industriales'] },
      { title: 'Sensores y actuadores', description: 'Selección e integración.', lessons: ['Sensores discretos', 'Señales analógicas', 'Actuadores eléctricos'] },
      { title: 'Diseño de secuencias', description: 'Modelado del proceso.', lessons: ['Estados y transiciones', 'GRAFCET', 'Interbloqueos'] },
      { title: 'Caso integrador', description: 'Automatización de una celda.', lessons: ['Especificación', 'Implementación', 'Validación'] },
    ],
  },
  {
    slug: 'instrumentacion-industrial',
    title: 'Instrumentación Industrial',
    shortDescription: 'Comprende señales, transmisores, calibración y lazos de medición usados en procesos.',
    description: 'Curso aplicado para seleccionar instrumentos, interpretar P&ID y verificar la calidad de las mediciones industriales.',
    category: 'Instrumentación', level: 'Intermedio', duration: '18 horas', durationHours: 18, instructor: 'Ing. Martín Salazar', image: courseImage, accent: '#7c3aed', badge: 'Nuevo', featured: false, isNew: true, isFree: false, popularity: 87, publishedAt: '2026-07-02',
    requirements: ['Álgebra básica', 'Fundamentos de electricidad'], objectives: ['Interpretar señales 4–20 mA', 'Seleccionar transmisores', 'Ejecutar una calibración'], audience: ['Instrumentistas', 'Técnicos de procesos', 'Estudiantes'], resources: ['Hojas de calibración', 'Símbolos ISA', 'Ejercicios de lazo'], courseBookIds: ['instrumentacion-de-procesos', 'automatizacion-industrial-practica'], relatedCourseSlugs: ['automatizacion-industrial', 'plc-siemens-desde-cero'],
    modules: [
      { title: 'Variables de proceso', description: 'Presión, nivel, caudal y temperatura.', lessons: ['Unidades', 'Principios de medición', 'Criterios de selección'] },
      { title: 'Señales industriales', description: 'Transmisión y acondicionamiento.', lessons: ['4–20 mA', 'Señales digitales', 'Ruido y aislamiento'] },
      { title: 'Calibración', description: 'Procedimientos y trazabilidad.', lessons: ['Patrones', 'Error e incertidumbre', 'Documentación'] },
      { title: 'Lazos de control', description: 'Lectura e integración.', lessons: ['P&ID', 'Elementos del lazo', 'Prueba de lazo'] },
    ],
  },
  {
    slug: 'seguridad-electrica',
    title: 'Seguridad Eléctrica',
    shortDescription: 'Identifica riesgos, aplica bloqueo y etiquetado y trabaja con criterios preventivos en planta.',
    description: 'Programa introductorio para reconocer peligros eléctricos y aplicar controles antes, durante y después de una intervención.',
    category: 'Seguridad Eléctrica', level: 'Básico', duration: '8 horas', durationHours: 8, instructor: 'Ing. Patricia León', image: courseImage, accent: '#b91c1c', badge: 'Gratuito', featured: false, isNew: true, isFree: true, popularity: 93, publishedAt: '2026-05-10',
    requirements: ['No se requiere experiencia previa'], objectives: ['Identificar peligros eléctricos', 'Aplicar LOTO', 'Seleccionar EPP'], audience: ['Personal técnico', 'Supervisores', 'Estudiantes'], resources: ['Checklist de trabajo seguro', 'Formato LOTO', 'Matriz básica de riesgos'], courseBookIds: ['seguridad-electrica-en-planta', 'instalaciones-electricas-industriales'], relatedCourseSlugs: ['motores-electricos', 'variadores-de-frecuencia-desde-cero'],
    modules: [
      { title: 'Riesgo eléctrico', description: 'Peligros y consecuencias.', lessons: ['Contacto directo e indirecto', 'Arco eléctrico', 'Evaluación de riesgo'] },
      { title: 'Controles preventivos', description: 'Jerarquía y procedimientos.', lessons: ['Desenergización', 'Bloqueo y etiquetado', 'Verificación de ausencia de tensión'] },
      { title: 'Protección personal', description: 'Selección y revisión del EPP.', lessons: ['Categorías de EPP', 'Inspección', 'Limitaciones'] },
      { title: 'Trabajo seguro', description: 'Planificación de una intervención.', lessons: ['Permiso de trabajo', 'Roles y comunicación', 'Respuesta ante incidentes'] },
    ],
  },
];

export const getLessonCount = (course: Course) =>
  course.modules.reduce((total, module) => total + module.lessons.length, 0);

export const getRelatedCourses = (course: Course) =>
  course.relatedCourseSlugs
    .map((slug) => courses.find((candidate) => candidate.slug === slug))
    .filter((candidate): candidate is Course => Boolean(candidate));

export const slugifyLesson = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export interface CourseLessonReference {
  title: string;
  slug: string;
  href: string;
  moduleTitle: string;
  moduleIndex: number;
  lessonIndex: number;
  globalIndex: number;
}

export const getCourseLessons = (course: Course): CourseLessonReference[] => {
  let globalIndex = 0;
  return course.modules.flatMap((module, moduleIndex) =>
    module.lessons.map((title, lessonIndex) => {
      const slug = slugifyLesson(title);
      const lesson = {
        title,
        slug,
        href: `/aula/${course.slug}/${slug}`,
        moduleTitle: module.title,
        moduleIndex,
        lessonIndex,
        globalIndex,
      };
      globalIndex += 1;
      return lesson;
    })
  );
};
