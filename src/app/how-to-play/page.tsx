import { redirect } from "next/navigation";

/** How to play retired — Luke doesn't need it. Keep route as a soft redirect. */
export default function HowToPlayRedirect() {
  redirect("/");
}
