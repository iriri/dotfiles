HISTFILE=~/.zsh_history
HISTSIZE=10000000
SAVEHIST=10000000
setopt histignoredups
setopt histignorespace
setopt histreduceblanks
PROMPT="%F{004}[%F{002}%* %F{013}%n%F{004}]%f "
RPROMPT="%F{008}%#%F{004}%2C"
setopt nobeep
bindkey -e
bindkey "^[[3~" delete-char
autoload -Uz compinit
compinit
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey '^x^e' edit-command-line

unset COLORTERM
unset LS_COLORS
export TERM=xterm-16color
export EDITOR=vim
export VISUAL=vim
alias grep="grep --color"
alias ls="ls --color"
alias rm="rm -i"

. /usr/share/fzf/shell/key-bindings.zsh
export FZF_DEFAULT_OPTS="--reverse --inline-info --preview 'head -100 {}'"

. ~/.bun/_bun
