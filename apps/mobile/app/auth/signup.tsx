import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { colors, fonts } from '../../src/lib/theme';
import { authAPI } from '../../src/lib/api';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSignUp = async () => {
    if (!email || !password || !username || !tosAccepted) return;
    setError('');
    setLoading(true);
    try {
      await signUp({ email, password, username, tos_accepted: tosAccepted });
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sign up failed');
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
          style={{ width: 200, height: 45, alignSelf: 'center', marginBottom: 24 }}
          resizeMode="contain"
        />

        <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.foreground, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 3 }}>
          Get Started
        </Text>
        <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.accent, textAlign: 'center', marginTop: 4 }}>
          FREE FOREVER
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.mutedDark, textAlign: 'center', marginBottom: 24 }}>
          Upgrade to Pro when you're ready
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
          Username
        </Text>
        <TextInput
          value={username}
          onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, ''))}
          placeholder="yourname"
          placeholderTextColor={colors.mutedDark}
          autoCapitalize="none"
          maxLength={30}
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
          placeholder="Min 8 characters"
          placeholderTextColor={colors.mutedDark}
          secureTextEntry
          style={{
            backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
            borderRadius: 8, padding: 14, color: colors.foreground, fontFamily: fonts.body,
            fontSize: 15, marginBottom: 16,
          }}
        />

        <TouchableOpacity
          onPress={() => setTosAccepted(!tosAccepted)}
          style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}
        >
          <View style={{
            width: 20, height: 20, borderWidth: 1,
            borderColor: tosAccepted ? colors.accent : colors.border,
            backgroundColor: tosAccepted ? colors.accent : 'transparent',
            borderRadius: 4, marginTop: 2,
          }} />
          <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.mutedDark, flex: 1, lineHeight: 16 }}>
            I agree to the Terms of Service, Privacy Policy, and acknowledge that sports betting legality varies by state.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSignUp}
          disabled={loading || !tosAccepted}
          style={{
            backgroundColor: (loading || !tosAccepted) ? colors.secondary : colors.accent,
            borderRadius: 8, padding: 16, alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.background, textTransform: 'uppercase', letterSpacing: 2 }}>
            {loading ? 'Creating Account...' : 'Create Free Account'}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.mutedDark }}>
            Already have an account?{' '}
          </Text>
          <Link href="/auth/signin" style={{ fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.accent }}>
            Sign In
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
