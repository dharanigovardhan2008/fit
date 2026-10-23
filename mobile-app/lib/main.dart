import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'auth/login_screen.dart';
import 'core/supabase_client.dart';
import 'core/theme.dart';
import 'member/member_home_screen.dart';
import 'member/scanner_screen.dart';
import 'owner/owner_attendance_screen.dart';
import 'trainer/trainer_home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppSupabase.init();
  runApp(const ProviderScope(child: GymSphereApp()));
}

final _router = GoRouter(routes: [
  GoRoute(path: '/', builder: (context, state) => const LoginScreen()),
  GoRoute(path: '/member/home', builder: (context, state) => const MemberHomeScreen()),
  GoRoute(path: '/member/scan', builder: (context, state) => const ScannerScreen()),
  GoRoute(path: '/trainer/home', builder: (context, state) => const TrainerHomeScreen()),
  GoRoute(path: '/owner/attendance', builder: (context, state) => const OwnerAttendanceScreen()),
]);

class GymSphereApp extends StatelessWidget {
  const GymSphereApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'GymSphere',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      routerConfig: _router,
    );
  }
}
