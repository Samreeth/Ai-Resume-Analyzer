/**
 * Skills Taxonomy and Header Configuration
 * Phase 7 Stage 1: Deterministic Skills Master Registry
 *
 * Defines canonical skill names, categories, recognized aliases, and
 * specialized token extraction patterns matching the database seeds.
 */

export const SKILL_CATEGORIES = {
  PROGRAMMING_LANGUAGE: 'Programming language',
  FRAMEWORK: 'Framework',
  DATABASE: 'Database',
  CLOUD: 'Cloud',
  DEVOPS: 'DevOps',
  TOOL: 'Tool',
  SOFT_SKILL: 'Soft skill',
};

/**
 * Curated Skills Taxonomy
 * Each entry specifies:
 * - name: Canonical skill name (must match database skills.skill_name)
 * - category: Skill category
 * - aliases: Array of accepted synonyms / acronyms
 * - isSpecial: Boolean flag indicating custom boundary / context rules
 */
export const SKILLS_TAXONOMY = [
  // ==========================================================================
  // Programming Languages
  // ==========================================================================
  { name: 'Python', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['python3', 'py'] },
  { name: 'JavaScript', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['JS', 'ECMAScript', 'ES6', 'ES2015', 'ES2020'] },
  { name: 'TypeScript', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['TS'] },
  { name: 'Java', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['Java8', 'Java11', 'Java17', 'Java21'] },
  { name: 'C++', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['CPP', 'C plus plus'], isSpecial: true },
  { name: 'C#', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['CSharp', 'C sharp'], isSpecial: true },
  { name: 'C', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['ANSI C', 'Embedded C'], isSpecial: true },
  { name: 'Go', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['Golang'], isSpecial: true },
  { name: 'Rust', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['Rustlang'] },
  { name: 'Ruby', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: [] },
  { name: 'PHP', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['PHP7', 'PHP8'] },
  { name: 'Swift', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: [] },
  { name: 'Kotlin', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: [] },
  { name: 'R', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['RStudio'], isSpecial: true },
  { name: 'SQL', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['T-SQL', 'PL/SQL', 'SQL queries'], isSpecial: true },
  { name: 'HTML5', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['HTML'] },
  { name: 'CSS3', category: SKILL_CATEGORIES.PROGRAMMING_LANGUAGE, aliases: ['CSS'] },
  { name: '.NET', category: SKILL_CATEGORIES.FRAMEWORK, aliases: ['.NET Core', 'ASP.NET', 'ASP.NET Core', '.Net'], isSpecial: true },

  // ==========================================================================
  // Frameworks & Libraries
  // ==========================================================================
  { name: 'React', category: SKILL_CATEGORIES.FRAMEWORK, aliases: ['React.js', 'ReactJS'] },
  { name: 'Node.js', category: SKILL_CATEGORIES.FRAMEWORK, aliases: ['NodeJS', 'Node JS', 'Node'], isSpecial: true },
  { name: 'Express.js', category: SKILL_CATEGORIES.FRAMEWORK, aliases: ['Express', 'ExpressJS'] },
  { name: 'Next.js', category: SKILL_CATEGORIES.FRAMEWORK, aliases: ['NextJS', 'Next'] },
  { name: 'FastAPI', category: SKILL_CATEGORIES.FRAMEWORK, aliases: [] },
  { name: 'Django', category: SKILL_CATEGORIES.FRAMEWORK, aliases: [] },
  { name: 'Flask', category: SKILL_CATEGORIES.FRAMEWORK, aliases: [] },
  { name: 'Spring Boot', category: SKILL_CATEGORIES.FRAMEWORK, aliases: ['Spring', 'SpringBoot'] },
  { name: 'Vue.js', category: SKILL_CATEGORIES.FRAMEWORK, aliases: ['Vue', 'VueJS'] },
  { name: 'Angular', category: SKILL_CATEGORIES.FRAMEWORK, aliases: ['AngularJS', 'Angular2+'] },
  { name: 'Tailwind CSS', category: SKILL_CATEGORIES.FRAMEWORK, aliases: ['Tailwind', 'TailwindCSS'] },
  { name: 'Redux', category: SKILL_CATEGORIES.FRAMEWORK, aliases: ['Redux Toolkit', 'RTK'] },

  // ==========================================================================
  // Databases
  // ==========================================================================
  { name: 'PostgreSQL', category: SKILL_CATEGORIES.DATABASE, aliases: ['Postgres', 'PSQL', 'PostgreSql'], isSpecial: true },
  { name: 'MySQL', category: SKILL_CATEGORIES.DATABASE, aliases: [] },
  { name: 'MongoDB', category: SKILL_CATEGORIES.DATABASE, aliases: ['Mongo'] },
  { name: 'Redis', category: SKILL_CATEGORIES.DATABASE, aliases: [] },
  { name: 'SQLite', category: SKILL_CATEGORIES.DATABASE, aliases: ['SQLite3'] },
  { name: 'Elasticsearch', category: SKILL_CATEGORIES.DATABASE, aliases: ['ElasticSearch', 'ELK'] },
  { name: 'Cassandra', category: SKILL_CATEGORIES.DATABASE, aliases: ['Apache Cassandra'] },

  // ==========================================================================
  // Cloud, DevOps & Tools
  // ==========================================================================
  { name: 'AWS', category: SKILL_CATEGORIES.CLOUD, aliases: ['Amazon Web Services'] },
  { name: 'Microsoft Azure', category: SKILL_CATEGORIES.CLOUD, aliases: ['Azure'] },
  { name: 'Google Cloud', category: SKILL_CATEGORIES.CLOUD, aliases: ['GCP', 'Google Cloud Platform'] },
  { name: 'Docker', category: SKILL_CATEGORIES.DEVOPS, aliases: ['Docker Compose'] },
  { name: 'Kubernetes', category: SKILL_CATEGORIES.DEVOPS, aliases: ['K8s', 'Kube'] },
  { name: 'Terraform', category: SKILL_CATEGORIES.DEVOPS, aliases: [] },
  { name: 'CI/CD', category: SKILL_CATEGORIES.DEVOPS, aliases: ['Continuous Integration', 'Continuous Delivery', 'CI-CD', 'GitHub Actions', 'GitLab CI'] },
  { name: 'Linux', category: SKILL_CATEGORIES.DEVOPS, aliases: ['GNU/Linux', 'Ubuntu', 'Debian', 'CentOS', 'RedHat'] },
  { name: 'Git', category: SKILL_CATEGORIES.TOOL, aliases: ['Version Control'] },
  { name: 'GitHub', category: SKILL_CATEGORIES.TOOL, aliases: [] },
  { name: 'REST APIs', category: SKILL_CATEGORIES.TOOL, aliases: ['REST', 'REST API', 'RESTful', 'RESTful API', 'RESTful APIs'], isSpecial: true },
  { name: 'GraphQL', category: SKILL_CATEGORIES.TOOL, aliases: [] },

  // ==========================================================================
  // Soft Skills
  // ==========================================================================
  { name: 'Communication', category: SKILL_CATEGORIES.SOFT_SKILL, aliases: ['Written Communication', 'Verbal Communication'] },
  { name: 'Problem Solving', category: SKILL_CATEGORIES.SOFT_SKILL, aliases: ['Troubleshooting', 'Analytical Thinking'] },
  { name: 'Teamwork', category: SKILL_CATEGORIES.SOFT_SKILL, aliases: ['Collaboration', 'Team Player'] },
  { name: 'Leadership', category: SKILL_CATEGORIES.SOFT_SKILL, aliases: ['Mentoring', 'Team Lead'] },
  { name: 'Critical Thinking', category: SKILL_CATEGORIES.SOFT_SKILL, aliases: [] },
  { name: 'Time Management', category: SKILL_CATEGORIES.SOFT_SKILL, aliases: ['Prioritization'] },
  { name: 'Agile Methodology', category: SKILL_CATEGORIES.SOFT_SKILL, aliases: ['Agile', 'Scrum', 'Kanban'] },
];

/**
 * Standard Header Cue Patterns for Section Classification
 */
export const SECTION_PATTERNS = {
  // Explicit Technical Skills Sections
  SKILLS_SECTION: [
    /^(?:TECHNICAL\s+)?SKILLS(?:\s*&|\s+AND|\s+EXPERTISE)?/i,
    /^CORE\s+COMPETENCIES/i,
    /^(?:PROGRAMMING\s+)?LANGUAGES(?:\s*&|\s+AND|\s+FRAMEWORKS)?/i,
    /^TECHNOLOGIES(?:\s*&|\s+TOOLS)?/i,
    /^TECH\s+STACK/i,
    /^TOOLS\s*(&|AND)\s*PLATFORMS/i,
    /^TECHNICAL\s+PROFICIENCIES/i,
    /^AREAS\s+OF\s+EXPERTISE/i,
  ],

  // Job Description: Mandatory / Required Qualifications
  REQUIRED: [
    /^REQUIREMENTS/i,
    /^MINIMUM\s+QUALIFICATIONS/i,
    /^REQUIRED(?:\s+SKILLS|\s+EXPERIENCE|\s+QUALIFICATIONS)?/i,
    /^WHAT\s+YOU(?:'LL|\s+WILL)?\s+(?:NEED|BRING)/i,
    /^MUST\s+HAVE/i,
    /^BASIC\s+QUALIFICATIONS/i,
    /^QUALIFICATIONS(?!\s+PREFERRED)/i,
  ],

  // Job Description: Preferred / Nice-To-Have Qualifications
  PREFERRED: [
    /^PREFERRED(?:\s+SKILLS|\s+EXPERIENCE|\s+QUALIFICATIONS)?/i,
    /^NICE\s+TO\s+HAVE/i,
    /^BONUS(?:\s+POINTS)?/i,
    /^PLUSES/i,
    /^DESIRED(?:\s+SKILLS|\s+EXPERIENCE)?/i,
    /^GOOD\s+TO\s+HAVE/i,
    /^ADDITIONAL(?:\s+QUALIFICATIONS|\s+ASSETS)?/i,
  ],
};

export default {
  SKILL_CATEGORIES,
  SKILLS_TAXONOMY,
  SECTION_PATTERNS,
};
