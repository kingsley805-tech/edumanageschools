import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { email, password, full_name, role, school_code, employee_no, admission_no, date_of_birth, gender, guardian_email } = await req.json();

    // Create user using admin API (doesn't auto-login)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name,
        role,
        school_code,
      },
    });

    if (authError) throw authError;

    // Wait for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update role-specific table with additional details
    if (role === 'teacher' && employee_no) {
      console.log('Updating teacher with employee_no:', employee_no);
      
      const { data: teacherData, error: teacherError } = await supabaseAdmin
        .from('teachers')
        .update({
          employee_no,
        })
        .eq('user_id', authData.user.id)
        .select();

      console.log('Teacher update result:', { teacherData, teacherError });
      if (teacherError) throw teacherError;
    } else if (role === 'student') {
      console.log('Updating student with data:', { admission_no, date_of_birth, gender, guardian_email });
      
      // Find or create parent if guardian_email provided
      let guardianId = null;
      if (guardian_email) {
        const { data: parentData } = await supabaseAdmin
          .from('profiles')
          .select('id, parents(id)')
          .eq('email', guardian_email)
          .single();

        if (parentData?.parents && Array.isArray(parentData.parents) && parentData.parents.length > 0) {
          guardianId = (parentData.parents[0] as any).id;
        }
      }

      const { data: studentData, error: studentError } = await supabaseAdmin
        .from('students')
        .update({
          admission_no,
          date_of_birth,
          gender,
          guardian_id: guardianId,
        })
        .eq('user_id', authData.user.id)
        .select();

      console.log('Student update result:', { studentData, studentError });
      if (studentError) throw studentError;
    }

    return new Response(
      JSON.stringify({ success: true, user: authData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});