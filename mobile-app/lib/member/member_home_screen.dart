import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/theme.dart';

class MemberHomeScreen extends StatelessWidget {
  const MemberHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 100),
          children: [
            const Text('Good to see you', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const Text('Your membership', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: AppColors.ink, borderRadius: BorderRadius.circular(24)),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Monthly plan', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                  SizedBox(height: 8),
                  Text('18 days left', style: TextStyle(color: Colors.white70, fontSize: 13)),
                ],
              ),
            ),
          ],
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.ink,
        shape: const CircleBorder(),
        onPressed: () => context.push('/member/scan'),
        child: const Icon(Icons.qr_code_scanner, color: Colors.white),
      ),
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        color: AppColors.ink,
        child: const SizedBox(height: 60),
      ),
    );
  }
}
