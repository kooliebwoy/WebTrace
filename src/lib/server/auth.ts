import { SvelteKitAuth } from "@auth/sveltekit"
import Resend from "@auth/sveltekit/providers/resend"
 
export const { handle } = SvelteKitAuth({
    providers: [Resend],
})