HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=1000000
bindkey -e
bindkey "^[[3~" delete-char
bindkey "^[[4~" delete-char
setopt histignorespace
setopt noincappendhistory
setopt nosharehistory
setopt no_beep
PROMPT="%F{004}[%F{001}%* %F{013}%n%F{004}]%F{reset} "
RPROMPT="%F{008}%#%F{005}%2C"
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey '^x^e' edit-command-line
alias grep="grep --color=auto"
alias rm="rm -i"
