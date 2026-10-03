{ [[ -v IRI_ZSHENV ]] && return } || export IRI_ZSHENV=1

export TMUX_TMPDIR=~/.cache/tmux

export DOTNET_CLI_TELEMETRY_OPTOUT=1

. ~/.cargo/env

PATH=~/.zig:"$PATH"

. ~/.deno/env

export GOPATH=~/devel/go
export GOTELEMETRY=off
PATH="$GOPATH/bin:/usr/local/go/bin:$PATH"

PATH=~/.opencode/bin:"$PATH"

PATH=~/.local/bin:"$PATH"
