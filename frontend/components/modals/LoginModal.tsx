"use client";

import { Modal } from "../Modal";
import { SignInForm } from "../SignInForm";
import { useToast } from "../Toast";

export function LoginModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  return (
    <Modal onClose={onClose}>
      <h3>Organizer Sign-in</h3>
      <SignInForm
        as="organizer"
        intro="We'll email you a 6-digit code. Only registered organizers can sign in."
        onCancel={onClose}
        onSignedIn={() => { onClose(); toast("Organizer mode on"); }}
      />
    </Modal>
  );
}
