import React, {useState} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FeatherIcons from 'react-native-vector-icons/Feather';

import {getErrorMessage} from '../../api/client';

const logoImage = require('../../assets/aisla-logo.png');

type LoginScreenProps = {
  onLogin: (credentials: {
    email: string;
    password: string;
    staySignedIn: boolean;
  }) => Promise<void> | void;
  onBack?: () => void;
  errorMessage?: string;
};

export function LoginScreen({
  onLogin,
  onBack,
  errorMessage: externalErrorMessage,
}: LoginScreenProps): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    const nextEmail = email.trim();

    if (!nextEmail || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await onLogin({email: nextEmail, password, staySignedIn});
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      style={styles.keyboardView}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={({pressed}) => [
                styles.backButton,
                pressed ? styles.pressed : null,
              ]}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          ) : null}

          <View style={styles.logoWrap}>
            <Image
              resizeMode="contain"
              source={logoImage}
              style={styles.logoImage}
            />
          </View>

          <View style={styles.copyBlock}>
            <Text style={styles.title}>Sign in to AISLA Care</Text>
            <Text style={styles.subtitle}>
              Use your account to access care updates and support.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor="#B8B8C7"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="#B8B8C7"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                />
                <Pressable
                  accessibilityLabel={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  onPress={() => setShowPassword(current => !current)}
                  style={({pressed}) => [
                    styles.visibilityToggle,
                    pressed ? styles.pressed : null,
                  ]}>
                  <FeatherIcons
                    color="#6A7E8F"
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={18}
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => setStaySignedIn(current => !current)}
              style={({pressed}) => [
                styles.checkboxRow,
                pressed ? styles.pressed : null,
              ]}>
              <View
                style={[
                  styles.checkbox,
                  staySignedIn ? styles.checkboxChecked : null,
                ]}>
                {staySignedIn ? (
                  <FeatherIcons
                    color="#FFFFFF"
                    name="check"
                    size={14}
                    style={styles.checkboxIcon}
                  />
                ) : null}
              </View>
              <Text style={styles.checkboxLabel}>Stay signed in</Text>
            </Pressable>

            <Pressable
              disabled={isSubmitting}
              onPress={() => {
                handleLogin().catch(() => undefined);
              }}
              style={({pressed}) => [
                styles.primaryButton,
                isSubmitting ? styles.primaryButtonDisabled : null,
                pressed ? styles.pressed : null,
              ]}>
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </Text>
            </Pressable>

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : externalErrorMessage ? (
              <Text style={styles.errorText}>{externalErrorMessage}</Text>
            ) : null}

            <Text style={styles.helperLink}>Forgot Password?</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#F8FBFD',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FBFD',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: 30,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 12,
    marginBottom: 12,
  },
  backButtonText: {
    fontFamily: 'Poppins-SemiBold',
    color: '#177BC8',
    fontSize: 15,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginVertical: 45,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  copyBlock: {},
  title: {
    fontFamily: 'Poppins-Bold',
    color: '#17375A',
    fontSize: 24,
    lineHeight: 32,
  },
  subtitle: {
    color: '#6A7E8F',
    fontSize: 15,
    lineHeight: 24,
  },
  formCard: {
    marginTop: 30,
    gap: 15,
  },
  field: {
    gap: 3,
  },
  label: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    color: '#17375A',
  },
  input: {
    height: 54,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D8ECFA',
    backgroundColor: '#F4FBFF',
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#000000',
  },
  passwordRow: {
    height: 54,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D8ECFA',
    backgroundColor: '#F4FBFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  visibilityToggle: {
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  checkboxRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#77AF32',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#77AF32',
  },
  checkboxIcon: {
    lineHeight: 14,
  },
  checkboxLabel: {
    marginLeft: 8,
    color: '#17375A',
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: '#177BC8',
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  errorText: {
    color: '#D93E32',
    fontSize: 14,
    lineHeight: 20,
  },
  helperLink: {
    alignSelf: 'flex-end',
    color: '#177BC8',
    fontSize: 14,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.84,
  },
});
