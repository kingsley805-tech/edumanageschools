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

    const { email, password, full_name, role, school_code, employee_no, subject_specialty, admission_no, date_of_birth, gender, class_id, guardian_email } = await req.json();

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
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update role-specific table with additional details
    if (role === 'teacher') {
      const { error: teacherError } = await supabaseAdmin
        .from('teachers')
        .update({
          employee_no,
          subject_specialty,
        })
        .eq('user_id', authData.user.id);

      if (teacherError) throw teacherError;
    } else if (role === 'student') {
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

      const { error: studentError } = await supabaseAdmin
        .from('students')
        .update({
          admission_no,
          date_of_birth,
          gender,
          class_id,
          guardian_id: guardianId,
        })
        .eq('user_id', authData.user.id);

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