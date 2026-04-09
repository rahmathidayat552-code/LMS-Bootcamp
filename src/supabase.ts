import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qbfvjbdcdgminlvfcfwb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZnZqYmRjZGdtaW5sdmZjZndiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NzM3NzUsImV4cCI6MjA4NjE0OTc3NX0.ZEIwxvVJfJvSr6cu-tw7JXCcJ8VBg04WgffwG8GSZok';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
