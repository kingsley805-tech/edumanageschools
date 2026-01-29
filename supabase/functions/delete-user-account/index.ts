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
    // Verify caller is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Verify the caller's JWT and check if they're an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
    
    if (callerError || !callerData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerData.user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.log('Unauthorized: User is not an admin:', callerData.user.id);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only admins can delete accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get admin's school_id
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('school_id')
      .eq('id', callerData.user.id)
      .single();

    if (!adminProfile?.school_id) {
      return new Response(
        JSON.stringify({ error: 'Admin school not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, user_role, user_name } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to the same school
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('school_id, full_name')
      .eq('id', user_id)
      .single();

    if (!userProfile || userProfile.school_id !== adminProfile.school_id) {
      return new Response(
        JSON.stringify({ error: 'User not found or belongs to different school' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the deletion in audit_logs before deleting
    await supabaseAdmin.from('audit_logs').insert({
      school_id: adminProfile.school_id,
      action_type: 'delete',
      entity_type: user_role || 'user',
      entity_id: user_id,
      performed_by: callerData.user.id,
      details: {
        deleted_user_id: user_id,
        deleted_user_name: user_name || userProfile.full_name,
        deleted_user_role: user_role,
        timestamp: new Date().toISOString(),
      },
    });

    // Delete the user using admin API
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      throw deleteError;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Delete user error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
