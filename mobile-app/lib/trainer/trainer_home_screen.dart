import 'package:flutter/material.dart';

import '../core/theme.dart';

class TrainerHomeScreen extends StatelessWidget {
  const TrainerHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Today'), backgroundColor: AppColors.background, elevation: 0),
      body: const Center(
        child: Text('Your members and today\'s attendance will appear here.',
            style: TextStyle(color: AppColors.textSecondary)),
      ),
    );
  }
}
