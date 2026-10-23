import 'package:supabase_flutter/supabase_flutter.dart';

/// Initializes the Supabase client from compile-time environment variables.
/// Pass values with: flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
class AppSupabase {
  static Future<void> init() async {
    await Supabase.initialize(
      url: const String.fromEnvironment('SUPABASE_URL'),
      anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY'),
    );
  }

  static SupabaseClient get client => Supabase.instance.client;

  /// Calls the login Edge Function with gym code, public id and password,
  /// so the real email is never exposed to the client.
  static Future<Map<String, dynamic>> login(
      String gymCode, String publicId, String password) async {
    final response = await client.functions.invoke('login', body: {
      'gymCode': gymCode,
      'publicId': publicId,
      'password': password,
    });
    if (response.status != 200) {
      throw Exception('Incorrect ID or password');
    }
    return response.data as Map<String, dynamic>;
  }
}
