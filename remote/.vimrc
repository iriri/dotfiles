syntax enable
filetype plugin indent on
set bs=2
set nu
set nois
set hls
set et
set sts=4
set ai
set sw=4
set vb
set t_vb=
set hid
set list
set lcs=tab:>-,trail:~,precedes:<,extends:>
set ls=2
set stl=[%n:\%f]%m%r%w%y[%{&ff}][%{&enc}]%=[%l,%v][%P]
set cul
hi CursorLine cterm=NONE ctermbg=0 ctermfg=NONE

au BufRead,BufNewFile * 2mat ErrorMsg '\%80v.'

au BufReadPost *
  \ if line("'\"") >= 1 && line("'\"") <= line('$') && &ft !~# 'commit' |
  \   exe "normal! g`\"" |
  \ endif
