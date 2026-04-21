import { Command } from "commander";

export const COMMANDS: Record<string, string[]> = {
  auth: ["login", "logout", "whoami"],
  config: ["get", "set"],
  run: ["start", "list", "get", "update", "cancel", "fork", "metrics", "verify", "narrative", "llm-calls", "nodes"],
  node: ["write", "list", "tail"],
  monitor: ["create", "list", "get", "update", "pause", "resume", "evaluate", "executions", "findings"],
  signal: ["emit", "list", "get", "ack", "resolve"],
  finding: ["list", "get", "update"],
  review: ["list", "get", "claim", "unclaim", "resolve"],
  agent: ["me", "set-key"],
  metrics: ["overview"],
  completions: ["bash", "zsh", "fish"],
};

const TOP_LEVEL = [
  ...Object.keys(COMMANDS),
  "login",
  "logout",
  "doctor",
  "version",
];

function bashCompletionScript(): string {
  const subcommandCases = Object.entries(COMMANDS)
    .map(
      ([cmd, subs]) =>
        `        ${cmd})\n            COMPREPLY=( $(compgen -W "${subs.join(" ")}" -- "$cur") )\n            return 0\n            ;;`,
    )
    .join("\n");

  return `# bash completion for invariance
_invariance() {
    local cur prev commands
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    commands="${TOP_LEVEL.join(" ")}"

    case "$prev" in
${subcommandCases}
    esac

    if [[ \${COMP_CWORD} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
        return 0
    fi
}
complete -F _invariance invariance
`;
}

function zshCompletionScript(): string {
  const subcommandCases = Object.entries(COMMANDS)
    .map(
      ([cmd, subs]) =>
        `        ${cmd})\n            local -a subcmds=(${subs.map((s) => `'${s}'`).join(" ")})\n            _describe 'subcommand' subcmds\n            ;;`,
    )
    .join("\n");

  return `#compdef invariance
# zsh completion for invariance

_invariance() {
    local -a commands=(${TOP_LEVEL.map((c) => `'${c}'`).join(" ")})

    _arguments '1:command:->cmd' '*::arg:->args'

    case "$state" in
    cmd)
        _describe 'command' commands
        ;;
    args)
        case "\${words[1]}" in
${subcommandCases}
        esac
        ;;
    esac
}
_invariance "$@"
`;
}

function fishCompletionScript(): string {
  const lines = [
    "# fish completion for invariance",
    "",
    `set -l commands ${TOP_LEVEL.join(" ")}`,
    `complete -c invariance -f -n "not __fish_seen_subcommand_from $commands" -a "$commands"`,
    "",
  ];

  for (const [cmd, subs] of Object.entries(COMMANDS)) {
    lines.push(
      `complete -c invariance -f -n "__fish_seen_subcommand_from ${cmd}" -a "${subs.join(" ")}"`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

export const completionsCommand = new Command("completions")
  .description("Generate shell completion scripts")
  .argument("<shell>", "Shell type: bash, zsh, or fish")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance completions bash >> ~/.bashrc
  $ invariance completions zsh >> ~/.zshrc
  $ invariance completions fish > ~/.config/fish/completions/invariance.fish`,
  )
  .action((shell: string) => {
    switch (shell) {
      case "bash":
        console.log(bashCompletionScript());
        break;
      case "zsh":
        console.log(zshCompletionScript());
        break;
      case "fish":
        console.log(fishCompletionScript());
        break;
      default:
        console.error(
          `Unknown shell: ${shell}. Supported shells: bash, zsh, fish`,
        );
        process.exit(1);
    }
  });

// Exported for testing
export { bashCompletionScript, zshCompletionScript, fishCompletionScript };
