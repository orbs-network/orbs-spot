import { AppLink } from "@/components/app-link";

// app/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h1>Page not found</h1>
      <AppLink href="/">Go back to home</AppLink>
    </div>
  );
}
