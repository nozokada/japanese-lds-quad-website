# Ruby 2.7+ removed Object#tainted?, which github-pages' pinned Liquid 4.0.3 still calls.
# Define it as a no-op so the site builds on modern Ruby.
module TaintedShim
  def tainted?
    false
  end
end
Object.prepend(TaintedShim)
