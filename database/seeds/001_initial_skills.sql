-- Seed 001: Standard Skills Dictionary
-- Idempotent: Uses ON CONFLICT ((LOWER(skill_name))) DO NOTHING to guarantee zero duplicates.

INSERT INTO skills (skill_name, category) VALUES
-- Programming Languages
('Python', 'Programming language'),
('JavaScript', 'Programming language'),
('TypeScript', 'Programming language'),
('Java', 'Programming language'),
('C++', 'Programming language'),
('C#', 'Programming language'),
('Go', 'Programming language'),
('Rust', 'Programming language'),
('Ruby', 'Programming language'),
('PHP', 'Programming language'),
('Swift', 'Programming language'),
('Kotlin', 'Programming language'),
('SQL', 'Programming language'),
('HTML5', 'Programming language'),
('CSS3', 'Programming language'),

-- Frameworks & Libraries
('React', 'Framework'),
('Node.js', 'Framework'),
('Express.js', 'Framework'),
('Next.js', 'Framework'),
('FastAPI', 'Framework'),
('Django', 'Framework'),
('Flask', 'Framework'),
('Spring Boot', 'Framework'),
('Vue.js', 'Framework'),
('Angular', 'Framework'),
('Tailwind CSS', 'Framework'),
('Redux', 'Framework'),

-- Databases
('PostgreSQL', 'Database'),
('MySQL', 'Database'),
('MongoDB', 'Database'),
('Redis', 'Database'),
('SQLite', 'Database'),
('Elasticsearch', 'Database'),
('Cassandra', 'Database'),

-- Cloud, DevOps & Infrastructure
('AWS', 'Cloud'),
('Microsoft Azure', 'Cloud'),
('Google Cloud', 'Cloud'),
('Docker', 'DevOps'),
('Kubernetes', 'DevOps'),
('Terraform', 'DevOps'),
('CI/CD', 'DevOps'),
('Linux', 'DevOps'),
('Git', 'Tool'),
('GitHub', 'Tool'),
('REST APIs', 'Tool'),
('GraphQL', 'Tool'),

-- Soft Skills
('Communication', 'Soft skill'),
('Problem Solving', 'Soft skill'),
('Teamwork', 'Soft skill'),
('Leadership', 'Soft skill'),
('Critical Thinking', 'Soft skill'),
('Time Management', 'Soft skill'),
('Agile Methodology', 'Soft skill')

ON CONFLICT ((LOWER(skill_name))) DO NOTHING;
