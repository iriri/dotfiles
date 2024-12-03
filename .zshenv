{ [[ -v IRI_ZSHENV ]] && return } || export IRI_ZSHENV=1

export TMUX_TMPDIR=~/.cache/tmux

export DOTNET_CLI_TELEMETRY_OPTOUT=1

export GOPATH=~/devel/go
PATH=$GOPATH/bin:/usr/local/go/bin:$PATH

. "$HOME/.cargo/env"

PATH=~/.local/bin:$PATH
