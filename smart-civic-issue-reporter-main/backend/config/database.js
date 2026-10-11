const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Database Schema for Smart Civic Issue Reporter
 * 
 * This file contains the Supabase database schema and initialization.
 * Run these SQL commands in your Supabase SQL Editor to set up the database.
 */

const databaseSchema = `
-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  sla_hours INTEGER DEFAULT 48, -- Service Level Agreement in hours
  head_of_department VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create enhanced users table with role-based permissions
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL, -- Hashed password
  role VARCHAR(20) DEFAULT 'authority' CHECK (role IN ('citizen', 'authority', 'admin', 'super_admin')),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  department_id INTEGER REFERENCES departments(id),
  ward_area VARCHAR(100), -- For location-based assignment
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create enhanced issues table with all advanced features
CREATE TABLE IF NOT EXISTS issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id VARCHAR(20) UNIQUE NOT NULL,
  citizen_name VARCHAR(255) NOT NULL,
  citizen_email VARCHAR(255) NOT NULL,
  citizen_phone VARCHAR(20),
  category VARCHAR(50) NOT NULL CHECK (category IN ('pothole', 'garbage', 'streetlight', 'graffiti', 'water', 'traffic', 'sidewalk', 'other')),
  subcategory VARCHAR(100),
  description TEXT,
  location JSONB NOT NULL, -- {lat, lng, address, ward, area}
  images TEXT[] DEFAULT '{}',
  
  -- Status lifecycle management
  status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected')),
  status_history JSONB DEFAULT '[]' :: JSONB, -- Array of status changes with timestamps
  
  -- Priority and severity system
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  severity_level VARCHAR(10) DEFAULT 'medium' CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
  confidence_score DECIMAL(3,2) DEFAULT 0.0, -- AI confidence score 0.00-1.00
  
  -- Department assignment and routing
  assigned_department_id INTEGER REFERENCES departments(id),
  assigned_to_user_id INTEGER REFERENCES users(id),
  routing_logs JSONB DEFAULT '[]' :: JSONB, -- Array of routing decisions
  
  -- SLA and timing
  sla_deadline TIMESTAMP WITH TIME ZONE,
  estimated_resolution_time TIMESTAMP WITH TIME ZONE,
  actual_resolution_time TIMESTAMP WITH TIME ZONE,
  
  -- Resolution information
  resolution_images TEXT[] DEFAULT '{}',
  resolution_notes TEXT,
  resolution_cost DECIMAL(10,2),
  resolved_by_user_id INTEGER REFERENCES users(id),
  
  -- Citizen feedback
  citizen_feedback_rating INTEGER CHECK (citizen_feedback_rating BETWEEN 1 AND 5),
  citizen_feedback_comment TEXT,
  citizen_feedback_at TIMESTAMP WITH TIME ZONE,
  
  -- Duplicate detection
  duplicate_of_issue_id VARCHAR(20) REFERENCES issues(issue_id),
  is_duplicate BOOLEAN DEFAULT FALSE,
  
  -- AI and automation metadata
  ai_classification JSONB, -- Store AI analysis results
  auto_escalated BOOLEAN DEFAULT FALSE,
  escalation_reason TEXT,
  
  -- Tracking timestamps
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_at TIMESTAMP WITH TIME ZONE,
  in_progress_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit logs table for tracking all changes
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL, -- 'issue', 'user', 'department'
  entity_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'status_change'
  old_values JSONB,
  new_values JSONB,
  changed_by_user_id INTEGER REFERENCES users(id),
  changed_by_ip VARCHAR(45),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  details TEXT
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_user_id INTEGER REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- 'issue_created', 'status_updated', 'issue_resolved', 'sla_warning'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  issue_id VARCHAR(20) REFERENCES issues(issue_id),
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_citizen_email ON issues(citizen_email);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_department ON issues(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_user ON issues(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity_level);
CREATE INDEX IF NOT EXISTS idx_issues_sla_deadline ON issues(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_issues_location ON issues USING GIN (location);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);
CREATE INDEX IF NOT EXISTS idx_issues_updated_at ON issues(updated_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_sent ON notifications(is_sent);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_issues_updated_at BEFORE UPDATE
ON issues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE
ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE
ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default departments
INSERT INTO departments (name, code, description, contact_email, sla_hours) VALUES
('Roads and Infrastructure', 'ROADS', 'Handles potholes, road repairs, and infrastructure issues', 'roads@city.gov', 48),
('Sanitation Department', 'SANITATION', 'Manages garbage collection, waste management, and cleanliness', 'sanitation@city.gov', 24),
('Water and Sewerage', 'WATER', 'Water supply, leakages, and sewerage issues', 'water@city.gov', 12),
('Electricity and Street Lighting', 'ELECTRICITY', 'Street lights, electrical issues, and power-related problems', 'electricity@city.gov', 24),
('Traffic Management', 'TRAFFIC', 'Traffic signals, road signs, and traffic-related issues', 'traffic@city.gov', 48),
('Parks and Recreation', 'PARKS', 'Park maintenance, recreational facilities', 'parks@city.gov', 72),
('Building and Planning', 'PLANNING', 'Construction issues, illegal buildings, planning violations', 'planning@city.gov', 168)
ON CONFLICT (code) DO NOTHING;

-- Insert enhanced authority users (default password for all: Admin@123)
INSERT INTO users (username, password, role, email, full_name, department_id, ward_area) VALUES
('admin', '$2b$12$bNCb.aUO3QxCEtAeKGQbXOKG19y8brEHaXGxf6OLq9X3rsTOOxEN.', 'admin', 'admin@city.gov', 'System Administrator', 1, 'Central'),
('roads_supervisor', '$2b$12$bNCb.aUO3QxCEtAeKGQbXOKG19y8brEHaXGxf6OLq9X3rsTOOxEN.', 'authority', 'roads@city.gov', 'Roads Department Supervisor', 1, 'North'),
('sanitation_head', '$2b$12$bNCb.aUO3QxCEtAeKGQbXOKG19y8brEHaXGxf6OLq9X3rsTOOxEN.', 'authority', 'sanitation@city.gov', 'Sanitation Department Head', 2, 'South'),
('water_engineer', '$2b$12$bNCb.aUO3QxCEtAeKGQbXOKG19y8brEHaXGxf6OLq9X3rsTOOxEN.', 'authority', 'water@city.gov', 'Water Department Engineer', 3, 'East'),
('electricity_tech', '$2b$12$bNCb.aUO3QxCEtAeKGQbXOKG19y8brEHaXGxf6OLq9X3rsTOOxEN.', 'authority', 'electricity@city.gov', 'Electrical Technician', 4, 'West')
ON CONFLICT (username) DO NOTHING;

-- Insert sample issues for demonstration
INSERT INTO issues (
  issue_id, citizen_name, citizen_email, category, description, 
  location, images, status, priority, created_at, updated_at
) VALUES
(
  'ISSUE-001',
  'John Doe',
  'john@example.com',
  'pothole',
  'Large pothole on Main Street causing traffic issues',
  '{"lat": 40.7128, "lng": -74.0060, "address": "Main Street, New York, NY"}',
  ARRAY['/uploads/sample-pothole.jpg'],
  'submitted',
  'medium',
  '2026-01-20T10:00:00Z',
  '2026-01-20T10:00:00Z'
),
(
  'ISSUE-002',
  'Jane Smith',
  'jane@example.com',
  'garbage',
  'Overflowing garbage bins on Oak Avenue',
  '{"lat": 40.7589, "lng": -73.9851, "address": "Oak Avenue, New York, NY"}',
  ARRAY['/uploads/sample-garbage.jpg'],
  'in_progress',
  'high',
  '2026-01-18T14:30:00Z',
  '2026-01-19T09:15:00Z'
),
(
  'ISSUE-003',
  'Mike Wilson',
  'mike@example.com',
  'streetlight',
  'Street light not working on Pine Street',
  '{"lat": 40.7505, "lng": -73.9934, "address": "Pine Street, New York, NY"}',
  ARRAY['/uploads/sample-streetlight.jpg'],
  'resolved',
  'low',
  '2026-01-15T18:45:00Z',
  '2026-01-17T11:20:00Z'
)
ON CONFLICT (issue_id) DO NOTHING;
`;

// Helper function to initialize database (for development)
const initializeDatabase = async () => {
  try {
    console.log('📊 Supabase database schema ready for initialization');
    console.log('📋 Copy the SQL schema to your Supabase SQL Editor to set up tables');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
};

// Test database connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('issues')
      .select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      console.log('⚠️  Database not yet set up. Please run the SQL schema in Supabase.');
      return false;
    }
    
    console.log('✅ Supabase database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

module.exports = {
  supabase,
  databaseSchema,
  initializeDatabase,
  testConnection
};