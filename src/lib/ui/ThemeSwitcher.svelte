<script lang="ts">
    import { browser } from '$app/environment';
    import { Moon, Sun } from '@lucide/svelte';
    import { onMount } from 'svelte';

    let app: HTMLHtmlElement;
    let theme = $state('');

    onMount(() => {
        app = document.querySelector('html') as HTMLHtmlElement;
        
        if ( browser ) {
            const storageThemeSettings = localStorage.getItem('theme') as string;
            theme = storageThemeSettings;
            
			if ( !theme ) {
				theme = 'light'; // set light theme as default
			}

			app?.setAttribute('data-theme', storageThemeSettings);
        }
    });
  
	// $: if ( theme && browser ) localStorage.setItem('theme', theme);
	// $: app?.setAttribute('data-theme', theme);

    const toggleTheme = () => {
        theme = theme === 'light' ? 'dark' : 'light';
        app.setAttribute('data-theme', theme);

        if (browser) {
            localStorage.setItem('theme', theme);
        }
    }
</script>

<button class="btn btn-circle btn-ghost" onclick={toggleTheme}>
    {#if theme === 'light'}
        <Moon />
    {/if}
    {#if theme === 'dark'}
        <Sun />
    {/if}
</button>
