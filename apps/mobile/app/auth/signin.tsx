import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { colors, fonts } from '../../src/lib/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSignIn = async () => {
    if (!email || !password) return;
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        style={{ backgroundColor: colors.background }}
      >
        <Image
          source={require('../../assets/logo-main.png')}
          style={{ width: 200, height: 45, alignSelf: 'center', marginBottom: 32 }}
          resizeMode="contain"
        />

        <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.foreground, textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 3 }}>
          Sign In
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.mutedDark, textAlign: 'center', marginBottom: 32 }}>
          Welcome back. Let&apos;s see your edge.
        </Text>

        {error ? (
          <View style={{ backgroundColor: 'rgba(239, 83, 80, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 83, 80, 0.4)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <Text style={{ color: colors.loss, fontSize: 13, fontFamily: fonts.body }}>{error}</Text>
          </View>
        ) : null}

        <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.mutedDark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 2 }}>
          Email
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedDark}
          keyboardType="email-address"
          autoCapitalize="none"
          style={{
            backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
            borderRadius: 8, padding: 14, color: colors.foreground, fontFamily: fonts.body,
            fontSize: 15, marginBottom: 16,
          }}
        />

        <Text style={{ fontFamily: fonts.display, fontSize: 12, color: colors.mutedDark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 2 }}>
          Password
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.mutedDark}
          secureTextEntry
          style={{
            backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
            borderRadius: 8, padding: 14, color: colors.foreground, fontFamily: fonts.body,
            fontSize: 15, marginBottom: 24,
          }}
        />

        <TouchableOpacity
          onPress={handleSignIn}
          disabled={loading}
          style={{
            backgroundColor: loading ? colors.secondary : colors.accent,
            borderRadius: 8, padding: 16, alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.background, textTransform: 'uppercase', letterSpacing: 2 }}>
            {loading ? 'Signing In...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.mutedDark }}>
            Don&apos;t have an account?{' '}
          </Text>
          <Link href="/auth/signup" style={{ fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.accent }}>
            Sign Up Free
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
