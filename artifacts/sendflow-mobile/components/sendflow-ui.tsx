import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { useState } from 'react';
import { useColors } from '@/hooks/useColors';

export function ScreenShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title={title} subtitle={subtitle} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 108 },
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function AppHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.primary, paddingTop: insets.top + 12 },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.brand}>
          <Image
            source={require('../assets/images/icon.png')}
            style={styles.brandIcon}
          />
          <Text style={styles.brandName}>SendFlow</Text>
        </View>
        <View style={styles.headerBell}>
          <Feather name="bell" size={19} color="#ffffff" />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>8</Text>
          </View>
        </View>
      </View>
      <Text style={styles.headerTitle}>{title}</Text>
      <Text style={styles.headerSubtitle}>{subtitle}</Text>
    </View>
  );
}

export function TransferScreen({ international }: { international: boolean }) {
  const colors = useColors();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const networkOrCountry = international ? 'Sénégal' : 'Wave';

  return (
    <ScreenShell
      title={international ? 'Transfert international' : 'Transfert inter réseau'}
      subtitle={
        international
          ? 'Envoyez de pays à pays, simplement.'
          : 'Envoyez dans le même pays vers un autre réseau.'
      }
    >
      <View style={[styles.heroCard, { backgroundColor: colors.card }]}>
        <View style={[styles.heroIcon, { backgroundColor: colors.secondary }]}>
          <Feather
            name={international ? 'globe' : 'repeat'}
            size={26}
            color={colors.primary}
          />
        </View>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          {international ? 'Choisissez une destination' : 'Choisissez un réseau'}
        </Text>
        <Text style={[styles.cardDescription, { color: colors.mutedForeground }]}>
          Les informations de votre transfert restent visibles avant confirmation.
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
          {international ? 'Pays de destination' : 'Réseau destinataire'}
        </Text>
        <View
          style={[
            styles.selectField,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <Feather name={international ? 'map-pin' : 'smartphone'} size={18} color={colors.primary} />
          <Text style={[styles.selectText, { color: colors.foreground }]}>
            {networkOrCountry}
          </Text>
          <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
        </View>

        <TransferField
          label="Numéro du bénéficiaire"
          placeholder="Ex. 90 00 00 00"
          value={recipient}
          onChangeText={setRecipient}
          keyboardType="phone-pad"
        />
        <TransferField
          label="Montant"
          placeholder="Ex. 25 000 FCFA"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <PrimaryButton
          title={submitted ? 'Transfert prêt' : 'Continuer'}
          icon={submitted ? 'check' : 'arrow-right'}
          disabled={submitted}
          onPress={() => setSubmitted(true)}
        />
      </View>

      {submitted && (
        <View style={[styles.successCard, { backgroundColor: '#eaf7f1' }]}>
          <Feather name="check-circle" size={20} color="#278d66" />
          <Text style={styles.successText}>
            Votre transfert est prêt à être confirmé.
          </Text>
        </View>
      )}
    </ScreenShell>
  );
}

function TransferField({
  label,
  value,
  onChangeText,
  ...props
}: TextInputProps & { label: string }) {
  const colors = useColors();

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          { backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground },
        ]}
      />
    </View>
  );
}

export function PrimaryButton({
  title,
  icon,
  onPress,
  disabled = false,
}: {
  title: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();

  return (
    <Pressable
      testID={`button-${title.toLowerCase().replaceAll(' ', '-')}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: disabled ? colors.muted : colors.primary },
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
      <Feather name={icon} size={19} color={colors.primaryForeground} />
    </Pressable>
  );
}

export function HistoryScreen() {
  const colors = useColors();
  const history = [
    { id: '1', type: 'Inter réseau', detail: 'Vers Wave · 90 00 00 00', amount: '47 000 FCFA', date: 'Aujourd’hui, 12:55', icon: 'repeat' as const },
    { id: '2', type: 'International', detail: 'Vers Sénégal · 77 000 00 00', amount: '25 000 FCFA', date: 'Hier, 08:17', icon: 'globe' as const },
    { id: '3', type: 'Carte cadeau', detail: 'Pour Mariam A.', amount: '15 000 FCFA', date: '16 sept. 2026', icon: 'gift' as const },
  ];

  return (
    <ScreenShell title="Historique" subtitle="Retrouvez vos mouvements SendFlow.">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Transactions récentes</Text>
        <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>3 opérations</Text>
      </View>
      <View style={[styles.listCard, { backgroundColor: colors.card }]}>
        {history.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.historyRow,
              index < history.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
            ]}
          >
            <View style={[styles.historyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name={item.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.historyCopy}>
              <Text style={[styles.historyType, { color: colors.foreground }]}>{item.type}</Text>
              <Text style={[styles.historyDetail, { color: colors.mutedForeground }]}>{item.detail}</Text>
              <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>{item.date}</Text>
            </View>
            <Text style={[styles.historyAmount, { color: colors.foreground }]}>{item.amount}</Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

export function GiftCardScreen() {
  const colors = useColors();
  const [selectedAmount, setSelectedAmount] = useState('15 000 FCFA');
  const [created, setCreated] = useState(false);
  const amounts = ['5 000 FCFA', '15 000 FCFA', '25 000 FCFA'];

  return (
    <ScreenShell title="Carte cadeau" subtitle="Offrez un transfert à un proche.">
      <View style={[styles.giftCard, { backgroundColor: colors.primary }]}>
        <View style={styles.giftCardTop}>
          <Feather name="gift" size={27} color="#ffffff" />
          <Text style={styles.giftCardLabel}>SEND FLOW GIFT</Text>
        </View>
        <Text style={styles.giftCardTitle}>Un cadeau qui circule.</Text>
        <Text style={styles.giftCardText}>Choisissez un montant et envoyez-le simplement.</Text>
        <View style={styles.giftCardOrb} />
      </View>

      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Montant de la carte</Text>
      <View style={styles.amountGrid}>
        {amounts.map((amount) => {
          const selected = selectedAmount === amount;
          return (
            <Pressable
              key={amount}
              testID={`button-gift-${amount.replaceAll(' ', '-').toLowerCase()}`}
              onPress={() => {
                void Haptics.selectionAsync();
                setSelectedAmount(amount);
              }}
              style={[
                styles.amountOption,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.amountText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                {amount}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TransferField label="Destinataire" placeholder="Nom ou numéro de téléphone" value="" onChangeText={() => undefined} />
      {created ? (
        <View style={[styles.successCard, { backgroundColor: '#eaf7f1' }]}>
          <Feather name="check-circle" size={20} color="#278d66" />
          <Text style={styles.successText}>Votre carte cadeau est prête.</Text>
        </View>
      ) : (
        <PrimaryButton title={`Créer ${selectedAmount}`} icon="gift" onPress={() => setCreated(true)} />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 22 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIcon: { width: 34, height: 34, borderRadius: 11 },
  brandName: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 21, letterSpacing: -0.7 },
  headerBell: { position: 'relative', width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)' },
  notificationBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#ff0000', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#6334c4' },
  notificationBadgeText: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 9 },
  headerTitle: { marginTop: 20, color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.6 },
  headerSubtitle: { marginTop: 5, color: 'rgba(255,255,255,0.78)', fontFamily: 'Inter_400Regular', fontSize: 14 },
  content: { paddingHorizontal: 16, paddingTop: 18, gap: 16 },
  heroCard: { borderRadius: 24, padding: 18, shadowColor: '#34205f', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  heroIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.3 },
  cardDescription: { marginTop: 5, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  fieldGroup: { marginTop: 18 },
  fieldLabel: { marginBottom: 8, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  selectField: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 14 },
  primaryButton: { minHeight: 54, marginTop: 22, borderRadius: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryButtonText: { color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 15 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  successCard: { borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 9 },
  successText: { flex: 1, color: '#278d66', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 3 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.3 },
  sectionCount: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  listCard: { borderRadius: 22, paddingHorizontal: 14, shadowColor: '#34205f', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  historyRow: { minHeight: 94, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  historyIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  historyCopy: { flex: 1, gap: 3 },
  historyType: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  historyDetail: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  historyDate: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  historyAmount: { maxWidth: 88, fontFamily: 'Inter_700Bold', fontSize: 12, textAlign: 'right' },
  giftCard: { minHeight: 205, overflow: 'hidden', borderRadius: 25, padding: 20, position: 'relative', shadowColor: '#34205f', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  giftCardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  giftCardLabel: { color: 'rgba(255,255,255,0.76)', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.2 },
  giftCardTitle: { marginTop: 38, maxWidth: 240, color: '#ffffff', fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.7 },
  giftCardText: { maxWidth: 240, marginTop: 7, color: 'rgba(255,255,255,0.78)', fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  giftCardOrb: { position: 'absolute', width: 180, height: 180, right: -53, bottom: -67, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.08)' },
  amountGrid: { flexDirection: 'row', gap: 8 },
  amountOption: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  amountText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});