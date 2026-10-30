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
fpath=(~/.zsh $fpath)
autoload -Uz compinit
compinit
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey "^x^e" edit-command-line

unset COLORTERM
unset LS_COLORS
export TERM=xterm-16color
export EDITOR=vim
export VISUAL=vim
alias ag=ast-grep
alias fd="fd -c never"
alias grep="grep --color"
alias ls="ls --color"
alias nv=nvim
alias rm="rm -i"

. <(fzf --zsh)
export FZF_DEFAULT_COMMAND="fd -HLt f -E .git"
export FZF_CTRL_T_COMMAND="fd -HLE .git"
export FZF_ALT_C_COMMAND="fd -HLt d -E .git"
export FZF_DEFAULT_OPTS="--reverse --info inline --preview 'head -100 {}'"

_fzf_compgen_path() {
  fd -HLE .git . "$1" | sed 's$^\./$$'
}

_fzf_compgen_dir() {
  fd -HLt d -E .git . "$1" | sed 's$^\./$$'
}

lsh() {
   print -z -- "$(command lsh "$@")"
}

_lsh() {
   BUFFER=$(command lsh -p $BUFFER)
   CURSOR=${#BUFFER}
   zle && zle reset-prompt
}
zle -N _lsh
bindkey "^x^l" _lsh
