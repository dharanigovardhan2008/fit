import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/supabase_client.dart';
import '../core/theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _gymCode = TextEditingController();
  final _userId = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await AppSupabase.login(
        _gymCode.text.trim(), _userId.text.trim(), _password.text);
      final role = result['session']?['user']?['app_metadata']?['role'] as String?;
      if (!mounted) return;
      switch (role) {
        case 'owner':
          context.go('/owner/attendance');
          break;
        case 'trainer':
          context.go('/trainer/home');
          break;
        default:
          context.go('/member/home');
      }
    } catch (_) {
      setState(() => _error = 'Incorrect ID or password');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 220,
                margin: const EdgeInsets.only(top: 24, bottom: 32),
                decoration: BoxDecoration(
                  color: AppColors.inkDeep,
                  borderRadius: BorderRadius.circular(24),
                ),
                alignment: Alignment.bottomLeft,
                padding: const EdgeInsets.all(24),
                child: const Text('GymSphere',
                    style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700)),
              ),
              const Text('Welcome back',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600, height: 40 / 28)),
              const SizedBox(height: 24),
              TextField(controller: _gymCode, decoration: const InputDecoration(hintText: 'Gym code')),
              const SizedBox(height: 16),
              TextField(controller: _userId, decoration: const InputDecoration(hintText: 'User ID')),
              const SizedBox(height: 16),
              TextField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(hintText: 'Password'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  child: Text(_loading ? 'Signing in...' : 'Login'),
                ),
              ),
              const SizedBox(height: 20),
              Center(
                child: TextButton(
                  onPressed: () {},
                  child: const Text('Register your gym', style: TextStyle(color: AppColors.textSecondary)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
