export type AssessmentDifficulty = 'Básica' | 'Intermedia' | 'Avanzada';

interface AssessmentQuestionBase {
  id: string;
  prompt: string;
  image?: { src: string; alt: string };
  explanation: string;
  points: number;
  difficulty: AssessmentDifficulty;
}

export interface SingleChoiceQuestion extends AssessmentQuestionBase {
  type: 'single-choice';
  options: Array<{ id: string; label: string }>;
  correctAnswer: string;
}

export interface MultipleChoiceQuestion extends AssessmentQuestionBase {
  type: 'multiple-choice';
  options: Array<{ id: string; label: string }>;
  correctAnswers: string[];
}

export interface TrueFalseQuestion extends AssessmentQuestionBase {
  type: 'true-false';
  correctAnswer: boolean;
}

export interface OrderingQuestion extends AssessmentQuestionBase {
  type: 'ordering';
  options: Array<{ id: string; label: string }>;
  correctOrder: string[];
}

export interface NumericQuestion extends AssessmentQuestionBase {
  type: 'numeric';
  unit?: string;
  placeholder?: string;
  correctAnswer: number;
  tolerance?: number;
}

export type AssessmentQuestion =
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | OrderingQuestion
  | NumericQuestion;

export type QuizAnswer = string | string[] | boolean | number | null;

export const checkAssessmentAnswer = (question: AssessmentQuestion, answer: QuizAnswer) => {
  if (question.type === 'single-choice' || question.type === 'true-false') return answer === question.correctAnswer;
  if (question.type === 'numeric') return typeof answer === 'number' && Math.abs(answer - question.correctAnswer) <= (question.tolerance ?? 0);
  if (!Array.isArray(answer)) return false;
  const expected = question.type === 'multiple-choice' ? question.correctAnswers : question.correctOrder;
  if (question.type === 'ordering') return answer.length === expected.length && answer.every((item, index) => item === expected[index]);
  const selected = [...answer].sort(); const correct = [...expected].sort();
  return selected.length === correct.length && selected.every((item, index) => item === correct[index]);
};

export interface Assessment {
  slug: string;
  courseSlug: string;
  title: string;
  description: string;
  questions: AssessmentQuestion[];
}

export const assessments: Assessment[] = [
  {
    slug: 'fundamentos-motores-y-variadores',
    courseSlug: 'variadores-de-frecuencia-desde-cero',
    title: 'Evaluación: motores y variadores',
    description: 'Comprueba tus conocimientos sobre motores de inducción, velocidad sincrónica, deslizamiento y variadores de frecuencia.',
    questions: [
      {
        id: 'q1', type: 'single-choice', difficulty: 'Básica', points: 10,
        prompt: '¿Qué parte del motor de inducción genera el campo magnético giratorio?',
        options: [{ id: 'a', label: 'El estator' }, { id: 'b', label: 'El rotor' }, { id: 'c', label: 'El rodamiento' }, { id: 'd', label: 'El ventilador' }],
        correctAnswer: 'a',
        explanation: 'Los bobinados del estator, alimentados con corriente alterna trifásica, producen el campo magnético giratorio.',
      },
      {
        id: 'q2', type: 'true-false', difficulty: 'Básica', points: 10,
        prompt: 'En operación motora normal, el rotor de un motor de inducción gira exactamente a la velocidad sincrónica.',
        correctAnswer: false,
        explanation: 'El rotor debe girar ligeramente más lento que el campo para que exista movimiento relativo, inducción y par. Esa diferencia se denomina deslizamiento.',
      },
      {
        id: 'q3', type: 'numeric', difficulty: 'Intermedia', points: 10,
        prompt: 'Calcula la velocidad sincrónica de un motor de 4 polos alimentado a 60 Hz.',
        placeholder: 'Ejemplo: 1800', unit: 'rpm', correctAnswer: 1800, tolerance: 0,
        explanation: 'Aplicando Ns = (120 × f) / p: (120 × 60) / 4 = 1800 rpm.',
      },
      {
        id: 'q4', type: 'multiple-choice', difficulty: 'Intermedia', points: 10,
        prompt: 'Selecciona todos los datos necesarios para calcular el deslizamiento porcentual.',
        options: [{ id: 'ns', label: 'Velocidad sincrónica' }, { id: 'nr', label: 'Velocidad real del rotor' }, { id: 'v', label: 'Tensión de línea' }, { id: 'cos', label: 'Factor de potencia' }],
        correctAnswers: ['ns', 'nr'],
        explanation: 'El deslizamiento se calcula con s = ((Ns − Nr) / Ns) × 100. Solo se necesitan la velocidad sincrónica y la velocidad real.',
      },
      {
        id: 'q5', type: 'ordering', difficulty: 'Intermedia', points: 10,
        prompt: 'Ordena el procedimiento para verificar el deslizamiento de un motor.',
        options: [{ id: 'measure', label: 'Medir la velocidad real del rotor' }, { id: 'evaluate', label: 'Comparar el resultado con placa, carga e historial' }, { id: 'calculate-ns', label: 'Calcular la velocidad sincrónica' }, { id: 'calculate-slip', label: 'Calcular el deslizamiento porcentual' }],
        correctOrder: ['calculate-ns', 'measure', 'calculate-slip', 'evaluate'],
        explanation: 'Primero se obtiene la referencia teórica, después se mide la velocidad real, se calcula la diferencia porcentual y finalmente se interpreta en contexto.',
      },
      {
        id: 'q6', type: 'numeric', difficulty: 'Avanzada', points: 10,
        prompt: 'Un motor tiene una velocidad sincrónica de 1800 rpm y gira a 1746 rpm. ¿Cuál es su deslizamiento?',
        placeholder: 'Ingresa el porcentaje', unit: '%', correctAnswer: 3, tolerance: 0.05,
        explanation: 's = ((1800 − 1746) / 1800) × 100 = 3 %.',
      },
      {
        id: 'q7', type: 'single-choice', difficulty: 'Básica', points: 10,
        prompt: '¿Cuál es la función principal de un variador de frecuencia aplicado a un motor?',
        image: { src: '/images/courses/variadores-de-frecuencia.svg', alt: 'Representación técnica de un variador conectado a un motor industrial' },
        options: [{ id: 'a', label: 'Controlar velocidad y par modificando frecuencia y tensión' }, { id: 'b', label: 'Convertir el motor trifásico en uno de corriente continua' }, { id: 'c', label: 'Eliminar todas las protecciones eléctricas' }, { id: 'd', label: 'Medir únicamente la resistencia del aislamiento' }],
        correctAnswer: 'a',
        explanation: 'El variador ajusta la frecuencia y la tensión suministradas al motor para controlar su velocidad y comportamiento dinámico.',
      },
      {
        id: 'q8', type: 'multiple-choice', difficulty: 'Intermedia', points: 10,
        prompt: '¿Qué comprobaciones son apropiadas antes de poner en marcha un variador?',
        options: [{ id: 'plate', label: 'Ingresar correctamente los datos de placa del motor' }, { id: 'earth', label: 'Verificar la puesta a tierra' }, { id: 'bypass', label: 'Puenteear las protecciones para evitar alarmas' }, { id: 'wiring', label: 'Revisar el cableado de potencia y control' }],
        correctAnswers: ['plate', 'earth', 'wiring'],
        explanation: 'Los datos de placa, la puesta a tierra y el cableado deben verificarse. Nunca se deben anular protecciones para realizar una puesta en marcha.',
      },
      {
        id: 'q9', type: 'true-false', difficulty: 'Intermedia', points: 10,
        prompt: 'Reducir la frecuencia de salida del variador reduce la velocidad sincrónica del campo magnético.',
        correctAnswer: true,
        explanation: 'Según Ns = (120 × f) / p, para un número de polos constante la velocidad sincrónica es directamente proporcional a la frecuencia.',
      },
      {
        id: 'q10', type: 'ordering', difficulty: 'Avanzada', points: 10,
        prompt: 'Ordena las etapas principales de conversión de energía dentro de un variador de frecuencia.',
        options: [{ id: 'inverter', label: 'El inversor genera una salida de frecuencia variable' }, { id: 'motor', label: 'El motor recibe la alimentación controlada' }, { id: 'rectifier', label: 'El rectificador convierte CA en CC' }, { id: 'dc-bus', label: 'El bus de CC filtra y almacena energía' }],
        correctOrder: ['rectifier', 'dc-bus', 'inverter', 'motor'],
        explanation: 'La red de CA se rectifica, el bus de CC estabiliza la energía y el inversor sintetiza la salida variable que alimenta al motor.',
      },
    ],
  },
];

export const getAssessmentForCourse = (courseSlug: string) =>
  assessments.find((assessment) => assessment.courseSlug === courseSlug);
