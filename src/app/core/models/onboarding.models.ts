export interface OnboardingStep {
    canContinue(): boolean;
    commit(): Promise<void>;
}