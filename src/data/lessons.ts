import type { Course, CourseLessonReference } from './courses';

export interface HeadingBlock { type: 'heading'; content: string; level?: 2 | 3 }
export interface ParagraphBlock { type: 'paragraph'; content: string }
export interface ListBlock { type: 'list'; items: string[]; ordered?: boolean }
export interface FormulaBlockData {
  type: 'formula';
  content: string;
  label?: string;
  variables?: Array<{ symbol: string; meaning: string; unit?: string }>;
}
export interface TechnicalImage {
  src: string;
  alt: string;
  caption?: string;
  credit?: string;
  sourceUrl?: string;
}
export interface ImageBlockData extends TechnicalImage { type: 'image' }
export interface ImageGalleryBlockData { type: 'gallery'; title?: string; images: TechnicalImage[] }
export interface TableBlock { type: 'table'; caption?: string; headers: string[]; rows: string[][] }
export interface AlertBlockData { type: 'note' | 'tip' | 'warning' | 'danger'; title?: string; content: string }
export interface ExampleBlock { type: 'example'; title: string; content: string[]; result?: string }
export interface StepsBlockData { type: 'steps'; title?: string; items: Array<{ title: string; content: string }> }
export type VideoProvider = 'youtube' | 'vimeo' | 'external' | 'local';
export interface VideoBlockData {
  type: 'video';
  provider: VideoProvider;
  source: string;
  title: string;
  description: string;
  duration: string;
  thumbnail: string;
  transcript?: string;
  placeholder?: boolean;
}
export interface ResourceFile {
  name: string;
  description: string;
  format: 'PDF' | 'Word' | 'Excel' | 'Presentación' | 'ZIP' | 'Enlace';
  category: 'Manual' | 'Ficha técnica' | 'Catálogo' | 'Material' | 'Biblioteca' | 'Curso';
  size: string;
  href: string;
  download?: boolean;
  placeholder?: boolean;
}
export interface ResourceBlockData { type: 'resource'; title?: string; description?: string; items: ResourceFile[] }
export interface GameBlockData { type: 'game'; game: 'matching' | 'sorting' | 'synchronous-speed' }

export type LessonContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | FormulaBlockData
  | ImageBlockData
  | ImageGalleryBlockData
  | TableBlock
  | AlertBlockData
  | ExampleBlock
  | StepsBlockData
  | ResourceBlockData
  | VideoBlockData
  | GameBlockData;

export interface LessonTheory {
  description: string;
  estimatedMinutes: number;
  objectives: string[];
  lessonBookIds?: string[];
  blocks: LessonContentBlock[];
}

const courseImage = '/images/courses/variadores-de-frecuencia.svg';
const mainCourse = 'variadores-de-frecuencia-desde-cero';

const lessonTheory: Record<string, LessonTheory> = {
  [`${mainCourse}/que-es-un-motor-de-induccion`]: {
    description: 'Comprende cómo un campo magnético giratorio produce movimiento sin contacto eléctrico directo con el rotor.',
    estimatedMinutes: 18,
    objectives: ['Reconocer las partes principales del motor', 'Explicar el principio de inducción electromagnética', 'Diferenciar estator y rotor'],
    lessonBookIds: ['motores-electricos-industriales'],
    blocks: [
      { type: 'heading', level: 2, content: 'El motor que mueve la industria' },
      { type: 'paragraph', content: 'El motor de inducción convierte energía eléctrica en energía mecánica. Se denomina “de inducción” porque la corriente del rotor no llega mediante cables: aparece por el campo magnético variable producido en el estator.' },
      { type: 'image', src: courseImage, alt: 'Portada técnica placeholder de un motor controlado por variador', caption: 'Imagen local placeholder para demostrar el bloque individual y sus controles de ampliación.', credit: 'Placeholder InduTech Academy' },
      { type: 'gallery', title: 'Galería técnica: campo magnético', images: [
        { src: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Rotating_magnetic_field.png?width=1280', alt: 'Diagrama del campo magnético giratorio producido por los bobinados del estator', caption: 'Campo magnético giratorio producido por el estator.', credit: 'United States Bureau of Naval Personnel · CC0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rotating_magnetic_field.png' },
        { src: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Campo_magnetico_rotatorio.jpg?width=900', alt: 'Representación vectorial de un campo magnético rotatorio trifásico', caption: 'Representación del teorema de Ferraris aplicada a un sistema trifásico.', credit: 'MdeVicente · CC0', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Campo_magnetico_rotatorio.jpg' },
      ] },
      { type: 'heading', level: 3, content: 'Partes esenciales' },
      { type: 'table', caption: 'Componentes principales del motor', headers: ['Componente', 'Función', 'Qué revisar'], rows: [['Estator', 'Genera el campo magnético giratorio', 'Bobinados, aislamiento y conexiones'], ['Rotor', 'Recibe el campo inducido y produce par', 'Barras, anillos y libertad de giro'], ['Entrehierro', 'Separa magnéticamente rotor y estator', 'Uniformidad y ausencia de roce'], ['Rodamientos', 'Soportan el eje y reducen fricción', 'Ruido, temperatura y lubricación']] },
      { type: 'note', title: 'Idea clave', content: 'El rotor siempre gira un poco más lento que el campo magnético. Esa diferencia permite que exista inducción y, por tanto, par motor.' },
      { type: 'example', title: 'Ejemplo en planta', content: ['Una bomba centrífuga recibe alimentación trifásica en el estator.', 'El campo magnético giratorio induce corriente en las barras del rotor.', 'La interacción entre ambos campos produce el par que mueve el impulsor.'], result: 'La energía eléctrica termina convertida en caudal y presión en el proceso.' },
      { type: 'tip', title: 'Consejo de diagnóstico', content: 'Si el motor zumba pero no acelera, no asumas de inmediato que el rotor está dañado. Verifica primero tensión, equilibrio de fases, carga mecánica y conexiones.' },
      { type: 'video', provider: 'local', source: '/media/video-local-placeholder.mp4', title: 'Video local de prueba — PLACEHOLDER', duration: '00:30 aprox.', description: 'Clip CC0 no técnico incluido únicamente para probar la reproducción local, la carga diferida y los controles. Sustituir por la animación educativa definitiva.', thumbnail: courseImage, transcript: 'Transcripción placeholder: este clip visual no contiene narración técnica. La transcripción definitiva deberá explicar cómo el estator genera el campo giratorio que induce corriente en el rotor.', placeholder: true },
      { type: 'resource', title: 'Descargas de la lección', description: 'Archivos placeholder válidos para probar la descarga sin abrir documentos automáticamente.', items: [
        { name: 'Ficha técnica de motor - PLACEHOLDER', description: 'Ficha de una página con datos explícitamente no especificados.', format: 'PDF', category: 'Ficha técnica', size: '1.5 KB', href: '/downloads/ficha-tecnica-motor-placeholder.pdf', download: true, placeholder: true },
        { name: 'Manual de motor de inducción - PLACEHOLDER', description: 'Manual breve de demostración para validar el flujo de descarga.', format: 'PDF', category: 'Manual', size: '1.4 KB', href: '/downloads/manual-motor-induccion-placeholder.pdf', download: true, placeholder: true },
      ] },
    ],
  },
  [`${mainCourse}/velocidad-sincronica`]: {
    description: 'Calcula la velocidad del campo magnético a partir de la frecuencia de alimentación y el número de polos del motor.',
    estimatedMinutes: 24,
    objectives: ['Aplicar la fórmula de velocidad sincrónica', 'Identificar frecuencia y número de polos', 'Interpretar resultados antes de parametrizar un variador'],
    lessonBookIds: ['motores-electricos-industriales', 'variadores-de-frecuencia'],
    blocks: [
      { type: 'heading', level: 2, content: '¿Qué representa la velocidad sincrónica?' },
      { type: 'paragraph', content: 'La velocidad sincrónica es la velocidad a la que gira el campo magnético del estator. No es exactamente la velocidad mecánica del eje: funciona como referencia teórica para comprender el comportamiento del motor.' },
      { type: 'formula', label: 'Velocidad sincrónica', content: 'Nₛ = (120 × f) / p', variables: [{ symbol: 'Nₛ', meaning: 'Velocidad sincrónica', unit: 'rpm' }, { symbol: 'f', meaning: 'Frecuencia eléctrica', unit: 'Hz' }, { symbol: 'p', meaning: 'Número total de polos', unit: 'polos' }] },
      { type: 'example', title: 'Ejemplo numérico', content: ['Datos: frecuencia f = 60 Hz y motor de p = 4 polos.', 'Sustituimos: Nₛ = (120 × 60) / 4.', 'Calculamos: 7200 / 4 = 1800 rpm.'], result: 'La velocidad sincrónica del campo es 1800 rpm.' },
      { type: 'table', caption: 'Velocidades sincrónicas más frecuentes', headers: ['Polos', '50 Hz', '60 Hz', 'Aplicación típica'], rows: [['2', '3000 rpm', '3600 rpm', 'Ventiladores de alta velocidad'], ['4', '1500 rpm', '1800 rpm', 'Bombas y transportadores'], ['6', '1000 rpm', '1200 rpm', 'Mezcladores'], ['8', '750 rpm', '900 rpm', 'Procesos de baja velocidad']] },
      { type: 'warning', title: 'No confundas las velocidades', content: 'La placa del motor suele mostrar una velocidad nominal menor que la sincrónica. Esa diferencia es normal y se llama deslizamiento; no indica por sí sola una falla.' },
      { type: 'heading', level: 3, content: 'Ejercicio práctico' },
      { type: 'steps', title: 'Calcula antes de comprobar', items: [{ title: 'Identifica los datos', content: 'Usa un motor de 6 polos conectado a una red de 50 Hz.' }, { title: 'Aplica la fórmula', content: 'Sustituye f = 50 y p = 6 en Nₛ = (120 × f) / p.' }, { title: 'Calcula', content: 'Resuelve 6000 / 6 y expresa el resultado en rpm.' }, { title: 'Contrasta', content: 'Busca una placa de motor de 6 polos y compara su velocidad nominal con el resultado teórico.' }] },
      { type: 'note', title: 'Respuesta de control', content: 'El campo gira a 1000 rpm. La velocidad nominal del eje será ligeramente inferior cuando el motor entregue carga.' },
      { type: 'game', game: 'synchronous-speed' },
      { type: 'danger', title: 'Seguridad primero', content: 'Nunca midas velocidad ni inspecciones una placa cerca de partes giratorias sin detener, aislar y bloquear el equipo conforme al procedimiento de planta.' },
      { type: 'resource', items: [{ name: 'Guía de variadores de frecuencia', description: 'Consulta parámetros de frecuencia y velocidad en la biblioteca.', format: 'Enlace', category: 'Biblioteca', size: 'En línea', href: '/biblioteca/variadores-de-frecuencia' }] },
    ],
  },
  [`${mainCourse}/deslizamiento`]: {
    description: 'Relaciona la velocidad del campo con la velocidad real del rotor para evaluar el desempeño del motor bajo carga.',
    estimatedMinutes: 20,
    objectives: ['Definir el deslizamiento', 'Calcularlo en rpm y porcentaje', 'Reconocer valores anormales durante una inspección'],
    lessonBookIds: ['motores-electricos-industriales'],
    blocks: [
      { type: 'heading', level: 2, content: 'La diferencia que produce par' },
      { type: 'paragraph', content: 'Para que el rotor reciba energía por inducción debe existir movimiento relativo entre él y el campo del estator. Por eso el rotor no alcanza la velocidad sincrónica cuando entrega par.' },
      { type: 'formula', label: 'Deslizamiento porcentual', content: 's = ((Nₛ − Nᵣ) / Nₛ) × 100', variables: [{ symbol: 's', meaning: 'Deslizamiento', unit: '%' }, { symbol: 'Nₛ', meaning: 'Velocidad sincrónica', unit: 'rpm' }, { symbol: 'Nᵣ', meaning: 'Velocidad real del rotor', unit: 'rpm' }] },
      { type: 'example', title: 'Motor de cuatro polos a 60 Hz', content: ['Velocidad sincrónica: 1800 rpm.', 'Velocidad medida en el eje: 1746 rpm.', 's = ((1800 − 1746) / 1800) × 100.'], result: 'El deslizamiento es 3 %, un valor razonable para muchos motores bajo carga nominal.' },
      { type: 'table', caption: 'Lectura orientativa del deslizamiento', headers: ['Condición', 'Comportamiento', 'Interpretación'], rows: [['Sin carga', 'Muy bajo', 'El rotor se acerca a la velocidad sincrónica'], ['Carga nominal', 'Bajo y estable', 'Operación esperada'], ['Sobrecarga', 'Aumenta', 'El motor demanda más par'], ['Rotor bloqueado', '100 %', 'No existe velocidad mecánica']] },
      { type: 'tip', title: 'Usa tendencias, no un dato aislado', content: 'Compara velocidad, corriente, carga y temperatura. Un aumento progresivo del deslizamiento puede indicar sobrecarga o un problema mecánico.' },
      { type: 'warning', title: 'Medición segura', content: 'Utiliza un tacómetro sin contacto cuando sea posible y respeta las distancias de seguridad definidas para el equipo.' },
      { type: 'steps', title: 'Procedimiento de verificación', items: [{ title: 'Obtén la referencia', content: 'Calcula Nₛ con frecuencia y polos.' }, { title: 'Mide la velocidad', content: 'Registra Nᵣ con un instrumento adecuado.' }, { title: 'Calcula el porcentaje', content: 'Aplica la fórmula de deslizamiento.' }, { title: 'Evalúa el contexto', content: 'Compara con placa, carga y tendencia histórica.' }] },
      { type: 'resource', items: [{ name: 'Ficha de inspección de motores', description: 'Material incluido en la ruta de Motores Eléctricos.', format: 'Enlace', category: 'Curso', size: 'En línea', href: '/cursos/motores-electricos' }] },
    ],
  },
};

export const getLessonTheory = (course: Course, lesson: CourseLessonReference): LessonTheory =>
  lessonTheory[`${course.slug}/${lesson.slug}`] ?? {
    description: `Introducción guiada a ${lesson.title.toLowerCase()} dentro del módulo ${lesson.moduleTitle}.`,
    estimatedMinutes: 12,
    objectives: [`Reconocer los conceptos esenciales de ${lesson.title.toLowerCase()}`, 'Relacionar la teoría con una aplicación industrial'],
    blocks: [
      { type: 'heading', level: 2, content: lesson.title },
      { type: 'paragraph', content: `Esta lección presenta los fundamentos de ${lesson.title.toLowerCase()} y su relación con ${course.title}. El contenido está organizado para ayudarte a identificar los criterios técnicos antes de aplicarlos en campo.` },
      { type: 'note', title: 'Contenido teórico de prueba', content: 'Esta lección utiliza la estructura modular del aula y está preparada para ampliarse en una siguiente carga editorial.' },
      { type: 'steps', title: 'Ruta de estudio sugerida', items: [{ title: 'Revisa el concepto', content: 'Lee la explicación y relaciona los términos con el módulo actual.' }, { title: 'Busca una aplicación', content: 'Identifica dónde aparece este concepto en un equipo o proceso real.' }, { title: 'Registra dudas', content: 'Anota los puntos que necesites contrastar con documentación técnica.' }] },
      { type: 'resource', items: [{ name: `Recursos de ${course.title}`, description: 'Consulta los materiales generales disponibles en la página del curso.', format: 'Enlace', category: 'Curso', size: 'En línea', href: `/cursos/${course.slug}` }] },
    ],
  };
